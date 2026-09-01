using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

public class NfcWedge {
    // Win32 constants
    public const uint SCARD_SCOPE_USER = 0;
    public const uint SCARD_SCOPE_SYSTEM = 2;
    public const uint SCARD_SHARE_SHARED = 2;
    public const uint SCARD_PROTOCOL_T0 = 1;
    public const uint SCARD_PROTOCOL_T1 = 2;
    public const uint SCARD_LEAVE_CARD = 0;
    
    // WinSCard APIs
    [DllImport("winscard.dll")]
    public static extern int SCardEstablishContext(uint dwScope, IntPtr pvReserved1, IntPtr pvReserved2, out IntPtr phContext);
    
    [DllImport("winscard.dll", EntryPoint = "SCardListReadersA", CharSet = CharSet.Ansi)]
    public static extern int SCardListReaders(IntPtr hContext, string mszGroups, byte[] mszReaders, ref uint pcchReaders);

    [DllImport("winscard.dll", EntryPoint = "SCardConnectA", CharSet = CharSet.Ansi)]
    public static extern int SCardConnect(IntPtr hContext, string szReader, uint dwShareMode, uint dwPreferredProtocols, out IntPtr phCard, out uint pdwActiveProtocol);

    [StructLayout(LayoutKind.Sequential)]
    public struct SCARD_IO_REQUEST
    {
        public uint dwProtocol;
        public uint cbPciLength;
    }

    [DllImport("winscard.dll")]
    public static extern int SCardTransmit(IntPtr hCard, ref SCARD_IO_REQUEST pioSendPci, byte[] pbSendBuffer, int cbSendLength, IntPtr pioRecvPci, byte[] pbRecvBuffer, ref int pcbRecvLength);

    [DllImport("winscard.dll")]
    public static extern int SCardDisconnect(IntPtr hCard, uint dwDisposition);

    [DllImport("winscard.dll")]
    public static extern int SCardReleaseContext(IntPtr hContext);
    
    private static Mutex mutex = null;
    private static string logFile = null;

    private static void Log(string message) {
        try {
            string line = string.Format("[{0}] {1}", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"), message);
            Console.WriteLine(line);
            if (!string.IsNullOrEmpty(logFile)) {
                File.AppendAllText(logFile, line + Environment.NewLine);
            }
        } catch { }
    }

    // Program entry point
    [STAThread]
    public static void Main(string[] args) {
        bool createdNew;
        mutex = new Mutex(true, "LSPayNfcKeyboardWedgeMutex", out createdNew);
        if (!createdNew) {
            // Already running
            return;
        }

        try {
            string dir = AppDomain.CurrentDomain.BaseDirectory;
            logFile = Path.Combine(dir, "log.txt");
            File.WriteAllText(logFile, "=== LSPay NFC Keyboard Wedge Started ===" + Environment.NewLine);
        } catch { }

        Log("Service active. Waiting for NFC reader...");

        IntPtr hContext = IntPtr.Zero;
        string currentReader = null;
        string lastScannedUid = null;

        while (true) {
            try {
                // Ensure SCard context
                if (hContext == IntPtr.Zero) {
                    int rc = SCardEstablishContext(SCARD_SCOPE_USER, IntPtr.Zero, IntPtr.Zero, out hContext);
                    if (rc != 0) {
                        rc = SCardEstablishContext(SCARD_SCOPE_SYSTEM, IntPtr.Zero, IntPtr.Zero, out hContext);
                    }
                    if (rc != 0) {
                        Log("Smart Card Service not ready, retrying in 3s...");
                        Thread.Sleep(3000);
                        continue;
                    }
                }

                // Find reader
                if (currentReader == null) {
                    uint pcchReaders = 0;
                    int rc = SCardListReaders(hContext, null, null, ref pcchReaders);
                    if (rc == 0 && pcchReaders > 0) {
                        byte[] mszReaders = new byte[pcchReaders];
                        rc = SCardListReaders(hContext, null, mszReaders, ref pcchReaders);
                        if (rc == 0) {
                            string allReaders = Encoding.ASCII.GetString(mszReaders);
                            string[] readerList = allReaders.Split(new char[] { '\0' }, StringSplitOptions.RemoveEmptyEntries);
                            if (readerList.Length > 0) {
                                currentReader = readerList[0];
                                Log("Connected to NFC Reader: " + currentReader);
                            }
                        }
                    }

                    if (currentReader == null) {
                        Thread.Sleep(2000);
                        continue;
                    }
                }

                // Try connecting to card on the reader
                IntPtr hCard = IntPtr.Zero;
                uint activeProtocol = 0;
                int connectRc = SCardConnect(hContext, currentReader, SCARD_SHARE_SHARED, SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1, out hCard, out activeProtocol);

                if (connectRc == 0) {
                    // Card is tapped! Request physical UID via standard APDU
                    SCARD_IO_REQUEST sendPci = new SCARD_IO_REQUEST();
                    sendPci.dwProtocol = activeProtocol;
                    sendPci.cbPciLength = (uint)Marshal.SizeOf(typeof(SCARD_IO_REQUEST));

                    byte[] sendBuffer = { 0xFF, 0xCA, 0x00, 0x00, 0x00 };
                    byte[] recvBuffer = new byte[256];
                    int recvLength = recvBuffer.Length;

                    int txRc = SCardTransmit(hCard, ref sendPci, sendBuffer, sendBuffer.Length, IntPtr.Zero, recvBuffer, ref recvLength);

                    if (txRc == 0 && recvLength >= 2) {
                        // Extract UID bytes (omit last 2 SW1/SW2 status bytes)
                        byte[] uidBytes = new byte[recvLength - 2];
                        Array.Copy(recvBuffer, uidBytes, recvLength - 2);
                        string uid = BitConverter.ToString(uidBytes).Replace("-", "").ToUpper();

                        // Fire once per card tap
                        if (uid != lastScannedUid) {
                            Log("Card Scanned UID: " + uid);
                            try {
                                SendKeys.SendWait(uid + "{ENTER}");
                            } catch (Exception ex) {
                                Log("Keystroke error: " + ex.Message);
                            }
                            lastScannedUid = uid;
                        }
                    }

                    SCardDisconnect(hCard, SCARD_LEAVE_CARD);
                    Thread.Sleep(250);
                } else {
                    // If reader unplugged
                    if (connectRc == unchecked((int)0x80100017) || connectRc == unchecked((int)0x80100009)) {
                        Log("Reader disconnected, waiting for reconnection...");
                        currentReader = null;
                    }
                    // Card was removed from reader -> ready for next scan
                    lastScannedUid = null;
                    Thread.Sleep(150);
                }
            } catch (Exception ex) {
                Log("Exception: " + ex.Message);
                Thread.Sleep(1000);
            }
        }
    }
}
