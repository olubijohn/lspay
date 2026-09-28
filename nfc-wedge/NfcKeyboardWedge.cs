using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

// ============================================================
// LSPay NFC Keyboard Wedge  —  v2 (Win32 SendInput edition)
// ============================================================
// Uses SendInput (low-level) instead of SendKeys so it works
// correctly when Chrome / Edge / any browser has focus.
// Reads card UIDs via PC/SC (winscard.dll) and types them
// followed by Enter into whichever window is active.
// ============================================================
public class NfcWedge {

    // ── PC/SC constants ───────────────────────────────────────
    const uint SCARD_SCOPE_USER   = 0;
    const uint SCARD_SCOPE_SYSTEM = 2;
    const uint SCARD_SHARE_SHARED = 2;
    const uint SCARD_PROTOCOL_T0  = 1;
    const uint SCARD_PROTOCOL_T1  = 2;
    const uint SCARD_LEAVE_CARD   = 0;

    [DllImport("winscard.dll")]
    static extern int SCardEstablishContext(uint dwScope, IntPtr r1, IntPtr r2, out IntPtr phContext);

    [DllImport("winscard.dll", EntryPoint = "SCardListReadersA", CharSet = CharSet.Ansi)]
    static extern int SCardListReaders(IntPtr hContext, string mszGroups, byte[] mszReaders, ref uint pcchReaders);

    [DllImport("winscard.dll", EntryPoint = "SCardConnectA", CharSet = CharSet.Ansi)]
    static extern int SCardConnect(IntPtr hContext, string szReader, uint dwShareMode, uint dwPreferredProtocols, out IntPtr phCard, out uint pdwActiveProtocol);

    [StructLayout(LayoutKind.Sequential)]
    struct SCARD_IO_REQUEST { public uint dwProtocol; public uint cbPciLength; }

    [DllImport("winscard.dll")]
    static extern int SCardTransmit(IntPtr hCard, ref SCARD_IO_REQUEST pioSendPci, byte[] pbSendBuffer, int cbSendLength, IntPtr pioRecvPci, byte[] pbRecvBuffer, ref int pcbRecvLength);

    [DllImport("winscard.dll")]
    static extern int SCardDisconnect(IntPtr hCard, uint dwDisposition);

    [DllImport("winscard.dll")]
    static extern int SCardReleaseContext(IntPtr hContext);

    // ── SendInput structures ──────────────────────────────────
    const int INPUT_KEYBOARD   = 1;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_UNICODE = 0x0004;
    const ushort VK_RETURN = 0x0D;

    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT {
        public ushort wVk;
        public ushort wScan;
        public uint   dwFlags;
        public uint   time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Explicit)]
    struct INPUT {
        [FieldOffset(0)]  public int type;
        [FieldOffset(4)]  public KEYBDINPUT ki;
        // pad to match union size on both 32/64-bit
        [FieldOffset(4)]  public long _pad1;
        [FieldOffset(12)] public long _pad2;
    }

    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    // ── Logging ───────────────────────────────────────────────
    static string logFile;
    static void Log(string msg) {
        try {
            string line = string.Format("[{0}] {1}", DateTime.Now.ToString("HH:mm:ss"), msg);
            Console.WriteLine(line);
            if (!string.IsNullOrEmpty(logFile))
                File.AppendAllText(logFile, line + Environment.NewLine);
        } catch { }
    }

    // ── Type a string using Win32 SendInput ───────────────────
    // Works in any window, including Chrome/Edge, because it
    // injects at the hardware-abstraction level (not WM_CHAR).
    static void TypeString(string text) {
        var inputs = new INPUT[text.Length * 2 + 2]; // key-down + key-up per char + Enter
        int idx = 0;

        foreach (char c in text) {
            // Key-down
            inputs[idx].type = INPUT_KEYBOARD;
            inputs[idx].ki   = new KEYBDINPUT {
                wVk    = 0,
                wScan  = (ushort)c,
                dwFlags = KEYEVENTF_UNICODE,
            };
            idx++;
            // Key-up
            inputs[idx].type = INPUT_KEYBOARD;
            inputs[idx].ki   = new KEYBDINPUT {
                wVk    = 0,
                wScan  = (ushort)c,
                dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
            };
            idx++;
        }

        // Enter key-down
        inputs[idx].type = INPUT_KEYBOARD;
        inputs[idx].ki   = new KEYBDINPUT { wVk = VK_RETURN, dwFlags = 0 };
        idx++;
        // Enter key-up
        inputs[idx].type = INPUT_KEYBOARD;
        inputs[idx].ki   = new KEYBDINPUT { wVk = VK_RETURN, dwFlags = KEYEVENTF_KEYUP };
        idx++;

        uint sent = SendInput((uint)idx, inputs, Marshal.SizeOf(typeof(INPUT)));
        if (sent != (uint)idx) {
            Log(string.Format("SendInput sent {0}/{1} events (error {2})", sent, idx, Marshal.GetLastWin32Error()));
        }
    }

    // ── Entry point ───────────────────────────────────────────
    [STAThread]
    public static void Main(string[] args) {
        // Single-instance guard
        bool isNew;
        var mutex = new System.Threading.Mutex(true, "LSPayNfcKeyboardWedgeMutex", out isNew);
        if (!isNew) return;

        try {
            string dir = AppDomain.CurrentDomain.BaseDirectory;
            logFile = Path.Combine(dir, "log.txt");
            File.WriteAllText(logFile, "=== LSPay NFC Keyboard Wedge v2 Started ===" + Environment.NewLine);
        } catch { }

        Log("Initialising — waiting for NFC reader (ACR122U / ACR1252 / any PC/SC reader)...");

        IntPtr hContext     = IntPtr.Zero;
        string currentReader = null;
        string lastScannedUid = null;

        while (true) {
            try {
                // ── Establish PC/SC context ───────────────────
                if (hContext == IntPtr.Zero) {
                    int rc = SCardEstablishContext(SCARD_SCOPE_USER, IntPtr.Zero, IntPtr.Zero, out hContext);
                    if (rc != 0)
                        rc = SCardEstablishContext(SCARD_SCOPE_SYSTEM, IntPtr.Zero, IntPtr.Zero, out hContext);
                    if (rc != 0) {
                        Log("Smart Card Service not ready — retrying in 3 s...");
                        Thread.Sleep(3000);
                        continue;
                    }
                }

                // ── Discover reader ───────────────────────────
                if (currentReader == null) {
                    uint pcch = 0;
                    int rc = SCardListReaders(hContext, null, null, ref pcch);
                    if (rc == 0 && pcch > 0) {
                        byte[] buf = new byte[pcch];
                        rc = SCardListReaders(hContext, null, buf, ref pcch);
                        if (rc == 0) {
                            string all = Encoding.ASCII.GetString(buf);
                            string[] list = all.Split(new char[] { '\0' }, StringSplitOptions.RemoveEmptyEntries);
                            if (list.Length > 0) {
                                currentReader = list[0];
                                Log("Reader found: " + currentReader);
                                Log("Ready — tap a card to type its UID into the active window.");
                            }
                        }
                    }
                    if (currentReader == null) { Thread.Sleep(2000); continue; }
                }

                // ── Poll for card ─────────────────────────────
                IntPtr hCard = IntPtr.Zero;
                uint   activeProtocol = 0;
                int connectRc = SCardConnect(hContext, currentReader, SCARD_SHARE_SHARED,
                                             SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1,
                                             out hCard, out activeProtocol);

                if (connectRc == 0) {
                    // Read UID via GET DATA APDU (FF CA 00 00 00)
                    var pci = new SCARD_IO_REQUEST {
                        dwProtocol  = activeProtocol,
                        cbPciLength = (uint)Marshal.SizeOf(typeof(SCARD_IO_REQUEST))
                    };
                    byte[] cmd  = { 0xFF, 0xCA, 0x00, 0x00, 0x00 };
                    byte[] resp = new byte[256];
                    int    respLen = resp.Length;

                    int txRc = SCardTransmit(hCard, ref pci, cmd, cmd.Length, IntPtr.Zero, resp, ref respLen);

                    if (txRc == 0 && respLen >= 2) {
                        byte[] uidBytes = new byte[respLen - 2];   // strip SW1/SW2
                        Array.Copy(resp, uidBytes, respLen - 2);
                        string uid = BitConverter.ToString(uidBytes).Replace("-", "").ToUpper();

                        if (uid != lastScannedUid) {
                            Log("Card UID: " + uid + "  →  typing into active window...");
                            TypeString(uid);           // ← SendInput, works in Chrome/Edge
                            lastScannedUid = uid;
                        }
                    }

                    SCardDisconnect(hCard, SCARD_LEAVE_CARD);
                    Thread.Sleep(250);
                } else {
                    // Reader unplugged?
                    int e = connectRc;
                    if (e == unchecked((int)0x80100017) || e == unchecked((int)0x80100009)) {
                        Log("Reader disconnected — waiting for reconnection...");
                        currentReader = null;
                    }
                    lastScannedUid = null;   // card removed → ready for next
                    Thread.Sleep(150);
                }

            } catch (Exception ex) {
                Log("Exception: " + ex.Message);
                Thread.Sleep(1000);
            }
        }
    }
}
