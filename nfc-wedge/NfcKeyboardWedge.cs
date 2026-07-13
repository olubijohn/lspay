using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

public class NfcWedge {
    // Win32 constants
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
    
    // Program entry point
    [STAThread]
    public static void Main(string[] args) {
        Console.WriteLine("==================================================");
        Console.WriteLine("LSPay NFC Keyboard Wedge Utility (ACR122U Support)");
        Console.WriteLine("==================================================");
        Console.WriteLine("This program runs in the background.");
        Console.WriteLine("When a card is tapped, it types the card's UID");
        Console.WriteLine("and presses Enter automatically.");
        Console.WriteLine("Press Ctrl+C to exit.");
        Console.WriteLine();
        
        IntPtr hContext = IntPtr.Zero;
        int rc = SCardEstablishContext(SCARD_SCOPE_SYSTEM, IntPtr.Zero, IntPtr.Zero, out hContext);
        if (rc != 0) {
            Console.WriteLine("Error establishing PC/SC context. Is the Smart Card service running? Error code: 0x{0:X}", rc);
            return;
        }
        
        string currentReader = null;
        string lastScannedUid = null;
        
        while (true) {
            // Find readers
            if (currentReader == null) {
                uint pcchReaders = 0;
                rc = SCardListReaders(hContext, null, null, ref pcchReaders);
                if (rc == 0 && pcchReaders > 0) {
                    byte[] mszReaders = new byte[pcchReaders];
                    rc = SCardListReaders(hContext, null, mszReaders, ref pcchReaders);
                    if (rc == 0) {
                        string allReaders = Encoding.ASCII.GetString(mszReaders);
                        string[] readerList = allReaders.Split(new char[] { '\0' }, StringSplitOptions.RemoveEmptyEntries);
                        if (readerList.Length > 0) {
                            currentReader = readerList[0];
                            Console.WriteLine("Found reader: " + currentReader);
                            Console.WriteLine("Waiting for card scan...");
                        }
                    }
                }
                
                if (currentReader == null) {
                    Console.WriteLine("No NFC readers found. Checking again in 2 seconds...");
                    Thread.Sleep(2000);
                    continue;
                }
            }
            
            // Try connecting to card
            IntPtr hCard = IntPtr.Zero;
            uint activeProtocol = 0;
            rc = SCardConnect(hContext, currentReader, SCARD_SHARE_SHARED, SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1, out hCard, out activeProtocol);
            
            if (rc == 0) {
                // Card connected! Get UID
                SCARD_IO_REQUEST sendPci = new SCARD_IO_REQUEST();
                sendPci.dwProtocol = activeProtocol;
                sendPci.cbPciLength = (uint)Marshal.SizeOf(typeof(SCARD_IO_REQUEST));
                
                byte[] sendBuffer = { 0xFF, 0xCA, 0x00, 0x00, 0x00 };
                byte[] recvBuffer = new byte[256];
                int recvLength = recvBuffer.Length;
                
                rc = SCardTransmit(hCard, ref sendPci, sendBuffer, sendBuffer.Length, IntPtr.Zero, recvBuffer, ref recvLength);
                
                if (rc == 0 && recvLength >= 2) {
                    // Extract UID (excluding the last 2 status bytes)
                    byte[] uidBytes = new byte[recvLength - 2];
                    Array.Copy(recvBuffer, uidBytes, recvLength - 2);
                    string uid = BitConverter.ToString(uidBytes).Replace("-", "").ToUpper();
                    
                    // Only scan if it's different from the last scanned UID
                    // Since lastScannedUid is cleared when the card is removed, this prevents duplicate typing
                    if (uid != lastScannedUid) {
                        Console.WriteLine("[{0}] Card Scanned UID: {1}", DateTime.Now.ToString("HH:mm:ss"), uid);
                        
                        // Simulate keyboard typing
                        try {
                            SendKeys.SendWait(uid + "{ENTER}");
                        } catch (Exception ex) {
                            Console.WriteLine("Error sending keystroke: " + ex.Message);
                        }
                        
                        lastScannedUid = uid;
                    }
                }
                
                SCardDisconnect(hCard, SCARD_LEAVE_CARD);
                
                // Check again in 300ms
                Thread.Sleep(300);
            } else {
                // If the error indicates reader was disconnected, reset reader state
                if (rc == unchecked((int)0x80100017) || rc == unchecked((int)0x80100009)) {
                    Console.WriteLine("Reader disconnected!");
                    currentReader = null;
                }
                
                // Card has been removed, so reset lastScannedUid so it can scan again when placed back
                lastScannedUid = null;
                
                Thread.Sleep(200);
            }
        }
    }
}
