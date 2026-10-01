import { naira } from "@/lib/money";
import { useState, useEffect } from "react";
import { useStore } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { ShoppingCart, Plus, Minus, CreditCard, X, CheckCircle2, Image as ImageIcon, Wifi, ChevronDown, ArrowLeft, Lock, ShieldCheck, Store } from "lucide-react";
import { InventoryItem, Student } from "@/lib/types";
import { useNfcScanner } from "@/lib/useNfcScanner";
import { QrScanner } from "@/components/QrScanner";
import { QrCode } from "lucide-react";

/** Live clock for the kiosk header; ticks on its own so the rest of the kiosk doesn't re-render. */
function KioskClock({ short }: { short?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <>{short ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : now.toLocaleTimeString()}</>;
}

export function TenantKiosk({ tenantId, onExit }: { tenantId: string, onExit: () => void }) {
  const { inventory, students, tenants, transactions, deductBalanceAndStock, addNotification, session, verifyStaffCode, verifyKioskExit, verifyWalletPin } = useStore();
  
  const tenantInventory = inventory.filter(i => i.tenantId === tenantId);
  const tenantStudents = students.filter(s => s.tenantId === tenantId);
  const activeTenant = tenants.find(t => t.id === tenantId);

  const [cart, setCart] = useState<{item: InventoryItem, qty: number}[]>([]);
  const [checkoutStage, setCheckoutStage] = useState<"cart" | "scan" | "verify" | "pin" | "success">("cart");
  const [scanInput, setScanInput] = useState("");
  const [scanError, setScanError] = useState("");
  const [posStudent, setPosStudent] = useState<Student | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");
  
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitPassword, setExitPassword] = useState("");
  const [exitError, setExitError] = useState("");

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  useEffect(() => {
    // Attempt fullscreen
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch(e) {}
    
    return () => {
      try {
        if (document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      } catch(e) {}
    };
  }, []);

  const cartTotal = cart.reduce((sum, c) => sum + (c.item.sellingPrice * c.qty), 0);
  const cartCost = cart.reduce((sum, c) => sum + (c.item.costPrice * c.qty), 0);

  const addToCart = (item: InventoryItem) => {
    if (item.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) {
        if (existing.qty >= item.stock) return prev;
        return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.item.id === id) {
        const newQty = Math.max(0, Math.min(c.qty + delta, c.item.stock));
        return { ...c, qty: newQty };
      }
      return c;
    }).filter(c => c.qty > 0));
  };

  const lookupCard = (rawId: string) => {
    setScanError("");
    const id = rawId.trim();
    if (!id) return;
    const student = tenantStudents.find(s => s.cardHardwareId === id);
    if (!student) {
      setScanError(`Card not recognised (${id}). Link this card to a student first.`);
      return;
    }
    if (student.cardStatus === "Blocked") {
      setScanError("Card is blocked. Please contact administration.");
      return;
    }

    if (student.cardStatus === "Unassigned") {
      setScanError("Card is unassigned.");
      return;
    }
    setPosStudent(student);
    setCheckoutStage("verify");
  };

  const handleScan = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    lookupCard(scanInput);
  };

  const { supported: nfcSupported, status: nfcStatus, error: nfcError, start: startNfc, stop: stopNfc } = useNfcScanner((id) => {
    lookupCard(id);
  });

  // Auto-activate the NFC reader as soon as we reach the scan screen (e.g. after "Pay Now").
  useEffect(() => {
    if (checkoutStage === "scan" && nfcSupported) {
      startNfc();
    } else {
      stopNfc();
    }
  }, [checkoutStage, nfcSupported, startNfc, stopNfc]);

  const notifyLimitBreach = (student: Student, kind: "daily" | "monthly", limit: number, alreadySpent: number) => {
    // every LSPay parent linked to the student gets a copy (database trigger, 0088)
    addNotification({
      targetRole: "parent",
      targetTenantId: student.tenantId,
      targetParentEmail: student.parentEmail || null,
      type: "limit_exceeded",
      message: `${student.name} attempted a ${naira(cartTotal)} purchase at ${activeTenant?.name ?? "the canteen"}, which would exceed their ${kind} spending limit of ${naira(limit)} (${naira(alreadySpent)} already spent ${kind === "daily" ? "today" : "this month"}). The purchase was declined.`,
      studentId: student.id,
      studentName: student.name,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  };

  const handlePinAuth = async () => {
    setPinError("");
    if (!posStudent) return;
    const pinOk = await verifyWalletPin(posStudent.id, enteredPin);
    if (!pinOk) {
      setPinError("Incorrect PIN.");
      setEnteredPin("");
      return;
    }
    if (posStudent.walletBalance < cartTotal) {
      setPinError(`Insufficient funds. Balance: ${naira(posStudent.walletBalance)}`);
      setEnteredPin("");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const monthStr = todayStr.slice(0, 7);
    const studentTx = transactions.filter(t => t.studentId === posStudent.id);
    const spentToday = studentTx.filter(t => t.date === todayStr).reduce((sum, t) => sum + t.amount, 0);
    const spentMonth = studentTx.filter(t => t.date.startsWith(monthStr)).reduce((sum, t) => sum + t.amount, 0);

    if (spentToday + cartTotal > posStudent.dailyLimit) {
      notifyLimitBreach(posStudent, "daily", posStudent.dailyLimit, spentToday);
      setPinError(`Daily limit of ${naira(posStudent.dailyLimit)} would be exceeded (${naira(spentToday)} already spent today). The parent has been notified.`);
      setEnteredPin("");
      return;
    }
    if (spentMonth + cartTotal > posStudent.monthlyLimit) {
      notifyLimitBreach(posStudent, "monthly", posStudent.monthlyLimit, spentMonth);
      setPinError(`Monthly limit of ${naira(posStudent.monthlyLimit)} would be exceeded (${naira(spentMonth)} already spent this month). The parent has been notified.`);
      setEnteredPin("");
      return;
    }

    // Success - deductBalanceAndStock now does the debit, limit re-check, inventory
    // decrement and transaction record atomically on the server (lspay_wallet_checkout).
    try {
      await deductBalanceAndStock(posStudent.id, cartTotal, cart.map(c => ({ id: c.item.id, qty: c.qty })));
    } catch (err: any) {
      setPinError(err?.message ?? "Checkout failed. Please try again.");
      setEnteredPin("");
      return;
    }
    setCheckoutStage("success");
  };

  const resetPos = () => {
    setCart([]);
    setCheckoutStage("cart");
    setScanInput("");
    setPosStudent(null);
    setEnteredPin("");
    setScanError("");
    setPinError("");
    setMobileSheetOpen(false);
  };

  const [isExiting, setIsExiting] = useState(false);

  const handleExit = async () => {
    if (!exitPassword.trim()) return;
    setIsExiting(true);
    setExitError("");
    try {
      const ok = await verifyKioskExit(tenantId, exitPassword);
      if (ok) {
        try {
          if (document.exitFullscreen && document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
        } catch(e) {}
        onExit();
      } else {
        setExitError("Incorrect password. Enter the password you use to sign in.");
      }
    } catch (e: any) {
      setExitError(e?.message || "Failed to verify password.");
    } finally {
      setIsExiting(false);
    }
  };

  const cartCount = cart.reduce((n, c) => n + c.qty, 0);
  const backBtnClass = "w-max h-12 px-5 rounded-full font-extrabold text-base border-border bg-card text-foreground shrink-0 active:scale-[.97] transition-transform [&_svg]:size-5";

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col font-sans h-screen w-screen overflow-hidden">
      {/* Top Header */}
      <header className="on-ink relative bg-ink text-white px-3 py-2.5 sm:px-5 sm:py-3 flex items-center gap-3 z-10 overflow-hidden shrink-0">
        <div className="pointer-events-none absolute -top-10 -right-6 h-32 w-32 rounded-full bg-white/[0.07]" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-24 w-24 rounded-full bg-gold/15" />
        <div className="relative flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
          {activeTenant?.logoUrl ? (
            <img
              src={activeTenant.logoUrl}
              alt=""
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl object-contain bg-white p-1 shadow-sm shrink-0"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Store className="h-5 w-5 sm:h-6 sm:w-6 text-gold" />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-display text-base sm:text-xl leading-tight truncate">
              {activeTenant?.name} POS Terminal
            </div>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-lilac/70 font-bold">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
              </span>
              <span className="truncate">Ready to serve</span>
            </div>
          </div>
        </div>
        <div className="relative hidden sm:block font-display tabular-nums text-2xl lg:text-3xl text-gold shrink-0"><KioskClock /></div>
        <Button
          variant="ghost"
          onClick={() => setShowExitModal(true)}
          className="relative h-12 min-w-12 px-3 sm:px-4 rounded-xl bg-white/10 text-white hover:bg-white/20 hover:text-white shrink-0 [&_svg]:size-5"
        >
          <X /> <span className="hidden sm:inline">Exit Kiosk</span>
        </Button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Digital Menu */}
        <div className="flex-1 min-w-0 bg-background flex flex-col h-full overflow-hidden">
          <div className="px-4 pt-4 pb-2 lg:px-6 lg:pt-5 flex items-end justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl text-foreground leading-tight">Menu</h2>
              <p className="text-sm sm:text-base text-muted-foreground font-semibold">Tap an item to add it to the order</p>
            </div>
            <span className="sm:hidden font-display tabular-nums text-lg text-muted-foreground shrink-0"><KioskClock short /></span>
          </div>
          <div className="overflow-y-auto px-4 lg:px-6 pt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 flex-1 content-start auto-rows-max pb-36 lg:pb-8 scrollbar-hide">
            {tenantInventory.map(item => {
              const inCart = cart.find(c => c.item.id === item.id)?.qty ?? 0;
              const available = item.stock > 0;
              return (
                <Card
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className={`group relative select-none flex flex-col overflow-hidden rounded-3xl border-2 p-2 transition-all duration-150 ${available ? `cursor-pointer bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[.97] ${inCart > 0 ? 'border-gold' : 'border-transparent hover:border-primary/30'}`
                    : 'cursor-not-allowed bg-card/60 border-transparent opacity-70'}`}
                >
                  <div className={`relative aspect-[4/3] rounded-2xl overflow-hidden shrink-0 ${item.imageUrl ? 'bg-white' : 'bg-lilac dark:bg-purple-900/40'}`}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain p-2" onError={(e) => { e.currentTarget.style.display='none'; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-purple-400">
                        <ImageIcon className="w-10 h-10 sm:w-12 sm:h-12" />
                      </div>
                    )}
                    {item.stock < 10 && item.stock > 0 && (
                      <div className="absolute top-2 left-2 bg-peach text-amber-700 text-[11px] sm:text-xs font-extrabold px-2 py-1 rounded-full shadow-sm">Low Stock</div>
                    )}
                    {inCart > 0 && (
                      <div className="absolute top-2 right-2 min-w-8 h-8 px-2 rounded-full bg-gold text-ink font-display text-base flex items-center justify-center shadow-md">×{inCart}</div>
                    )}
                    {available && (
                      <div className="pointer-events-none absolute bottom-2 right-2 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                        <Plus className="h-5 w-5" />
                      </div>
                    )}
                    {item.stock <= 0 && (
                      <div className="absolute inset-0 bg-background/70 flex items-center justify-center backdrop-blur-[2px]">
                        <span className="bg-blush text-red-700 font-extrabold text-xs sm:text-sm px-3 py-1.5 rounded-full shadow-sm">Out of stock</span>
                      </div>
                    )}
                  </div>
                  <CardContent className="px-2 pt-3 pb-2 flex flex-col justify-between flex-1 gap-2">
                    <div>
                      <Badge variant="outline" className="bg-muted border-transparent text-muted-foreground mb-1.5 text-[10px] tracking-wider rounded-full">{item.category}</Badge>
                      <h3 className="font-extrabold text-foreground leading-tight line-clamp-2 text-base sm:text-lg">{item.name}</h3>
                    </div>
                    <div className="flex justify-between items-end gap-2">
                      <span className="text-primary dark:text-gold font-display text-xl sm:text-2xl leading-none">{naira(item.sellingPrice)}</span>
                      <span className="text-xs sm:text-sm font-bold text-muted-foreground whitespace-nowrap">{item.stock} left</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {tenantInventory.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center text-center py-20 text-muted-foreground">
                <div className="h-20 w-20 rounded-full bg-lilac dark:bg-purple-900/40 flex items-center justify-center mb-4">
                  <Store className="h-9 w-9 text-purple-400" />
                </div>
                <p className="text-lg font-extrabold text-foreground">No items on the menu yet</p>
                <p className="text-sm">Add products in Inventory to start selling.</p>
              </div>
            )}
          </div>
        </div>

        {/* Cart Sidebar (desktop) / Checkout overlay (mobile) */}
        <div className={`bg-card border-border flex-col h-full lg:flex lg:w-[400px] xl:w-[460px] lg:shrink-0 lg:static lg:border-l lg:z-10 ${mobileSheetOpen ? 'flex fixed inset-0 z-[10000]' : 'hidden'}`}>
          {checkoutStage === "cart" && (
            <>
              <div className="px-4 py-4 sm:px-6 border-b border-border flex justify-between items-center gap-3 bg-card shrink-0">
                <h2 className="text-foreground text-2xl flex items-center gap-3 min-w-0">
                  <span className="h-11 w-11 rounded-2xl bg-lilac dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                    <ShoppingCart className="h-5 w-5 text-purple-700 dark:text-purple-300" />
                  </span>
                  <span className="truncate">Current Order</span>
                </h2>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className="bg-gold text-ink border-transparent text-sm px-3 py-1 font-extrabold rounded-full hover:bg-gold">{cart.length} items</Badge>
                  <Button variant="ghost" size="icon" className="lg:hidden text-muted-foreground hover:text-foreground h-12 w-12 rounded-xl [&_svg]:size-6" onClick={() => setMobileSheetOpen(false)} data-testid="btn-mobile-close"><ChevronDown /></Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground px-6">
                    <div className="h-24 w-24 rounded-full bg-lilac dark:bg-purple-900/40 flex items-center justify-center mb-5">
                      <ShoppingCart className="w-11 h-11 text-purple-400" />
                    </div>
                    <p className="text-xl font-extrabold text-foreground">Nothing here yet</p>
                    <p className="text-base">Tap items to add to order</p>
                  </div>
                ) : (
                  cart.map(c => (
                    <div key={c.item.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-2xl shadow-sm">
                      <div className="h-14 w-14 rounded-xl bg-white border border-border overflow-hidden shrink-0 flex items-center justify-center">
                        {c.item.imageUrl ? (
                          <img src={c.item.imageUrl} alt="" className="w-full h-full object-contain p-1" onError={(e) => { e.currentTarget.style.display='none'; }} />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-extrabold text-foreground text-base sm:text-lg leading-tight truncate">{c.item.name}</div>
                        <div className="text-muted-foreground text-sm">{naira(c.item.sellingPrice)} each</div>
                        <div className="text-primary dark:text-gold font-display text-lg leading-tight">{naira((c.item.sellingPrice * c.qty))}</div>
                      </div>
                      <div className="flex items-center gap-1 bg-muted rounded-2xl p-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl bg-card text-foreground shadow-sm hover:bg-accent active:scale-90 transition-transform [&_svg]:size-5" onClick={() => updateCartQty(c.item.id, -1)}><Minus /></Button>
                        <span className="w-8 text-center text-foreground font-display text-xl tabular-nums">{c.qty}</span>
                        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl bg-card text-foreground shadow-sm hover:bg-accent active:scale-90 transition-transform [&_svg]:size-5" onClick={() => updateCartQty(c.item.id, 1)}><Plus /></Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 sm:p-6 border-t border-border bg-card shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="flex justify-between items-end gap-3 mb-4">
                  <div>
                    <div className="text-muted-foreground text-sm font-extrabold tracking-wider">Total Due</div>
                    <div className="text-muted-foreground text-sm">{cartCount} {cartCount === 1 ? "item" : "items"}</div>
                  </div>
                  <span className="text-4xl sm:text-5xl font-display text-foreground tabular-nums leading-none truncate">{naira(cartTotal)}</span>
                </div>
                <Button
                  variant="highlight"
                  className="w-full h-16 sm:h-20 text-xl sm:text-2xl rounded-2xl shadow-md transition-transform active:scale-[.98] disabled:opacity-50 [&_svg]:size-6"
                  disabled={cart.length === 0}
                  onClick={() => setCheckoutStage("scan")}
                >
                  <CreditCard /> Pay Now
                </Button>
                <Button variant="ghost" className="w-full mt-2 text-muted-foreground h-12 rounded-xl font-extrabold" onClick={resetPos} disabled={cart.length === 0}>
                  Cancel Order
                </Button>
              </div>
            </>
          )}

          {checkoutStage === "scan" && (
            <div className="p-4 sm:p-6 flex flex-col h-full bg-background overflow-y-auto">
              <Button variant="outline" onClick={() => setCheckoutStage("cart")} className={backBtnClass}><ArrowLeft /> Back to Order</Button>

              <div className="flex-1 flex flex-col items-center justify-center py-4">
                <div className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-1.5 mb-4 shadow-sm">
                  <span className="text-sm text-muted-foreground font-bold">Total</span>
                  <span className="font-display text-lg text-foreground tabular-nums">{naira(cartTotal)}</span>
                </div>
                <h2 className="text-3xl sm:text-4xl text-foreground text-center mb-2">Scan Student Card</h2>
                <p className="bg-sky dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-4 py-2.5 rounded-2xl text-sm sm:text-base font-bold text-center mb-8 max-w-md">
                  {!nfcSupported
                    ? "NFC not available on this device. Please enter the Hardware ID below."
                    : nfcStatus === "scanning"
                      ? "Hold the card flat against the back of the device…"
                      : "Please scan the student's card or enter their Hardware ID below."}
                </p>

                <div className="relative w-48 h-48 sm:w-60 sm:h-60 mb-8 flex items-center justify-center shrink-0">
                  {nfcStatus === "scanning" && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-gold/20 animate-ping" />
                      <div className="absolute -inset-3 rounded-full border-2 border-gold/40 animate-pulse" />
                    </>
                  )}
                  <div className={`relative w-full h-full rounded-full flex items-center justify-center border-[6px] transition-colors ${nfcStatus === "scanning" ? "bg-card border-gold shadow-lg shadow-gold/20" : "bg-card border-border shadow-sm"}`}>
                    <div className={`h-3/5 w-3/5 rounded-full flex items-center justify-center ${nfcStatus === "scanning" ? "bg-peach dark:bg-amber-900/40" : "bg-lilac dark:bg-purple-900/40"}`}>
                      <CreditCard className={`w-16 h-16 sm:w-20 sm:h-20 ${nfcStatus === "scanning" ? "text-amber-700 dark:text-amber-300" : "text-purple-700 dark:text-purple-300"}`} />
                    </div>
                    <Wifi className={`absolute top-6 right-6 sm:top-8 sm:right-8 h-7 w-7 rotate-45 ${nfcStatus === "scanning" ? "text-gold animate-pulse" : "text-muted-foreground/50"}`} />
                  </div>
                </div>

                {scanError && <Alert className="bg-blush dark:bg-red-900/40 border-red-400/40 text-red-700 dark:text-red-300 mb-4 w-full max-w-md rounded-2xl"><AlertTitle className="text-center text-base sm:text-lg font-extrabold">{scanError}</AlertTitle></Alert>}
                {nfcSupported && nfcError && <Alert className="bg-blush dark:bg-red-900/40 border-red-400/40 text-red-700 dark:text-red-300 mb-4 w-full max-w-md rounded-2xl"><AlertTitle className="text-center text-base font-extrabold">{nfcError}</AlertTitle></Alert>}

                <div className="w-full max-w-sm space-y-3 mb-5">
                  {nfcSupported && (
                    <Button
                      type="button"
                      onClick={() => startNfc()}
                      className="w-full h-16 text-xl rounded-2xl active:scale-[.98] transition-transform [&_svg]:size-6"
                      data-testid="btn-scan-card"
                    >
                      <Wifi />
                      {nfcStatus === "scanning" ? "Scanning… Tap Card" : "Scan NFC Card"}
                    </Button>
                  )}
                  <QrScanner
                    triggerClassName={`w-full h-16 text-xl rounded-2xl font-extrabold active:scale-[.98] transition-transform [&_svg]:size-6 ${nfcSupported ? "bg-card border-2 border-border text-foreground hover:bg-accent" : "bg-primary hover:bg-primary-hover text-primary-foreground border-0"}`}
                    onResult={(text) => { lookupCard(text); }}
                  >
                    <QrCode className="mr-1" /> Scan QR Card
                  </QrScanner>
                </div>

                <div className="w-full max-w-sm flex items-center gap-3 mb-3 text-muted-foreground text-xs font-extrabold tracking-wider">
                  <span className="h-px flex-1 bg-border" /> or type it in <span className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={handleScan} className="w-full max-w-sm flex flex-col sm:flex-row gap-2">
                  <Input
                    type="text"
                    value={scanInput}
                    onChange={e => setScanInput(e.target.value)}
                    placeholder={nfcSupported ? "Or enter Hardware ID manually" : "Hardware ID (NFC-9982)"}
                    className="flex-1 min-w-0 bg-card border-border text-foreground text-center h-14 text-base sm:text-lg rounded-2xl font-mono tracking-widest"
                  />
                  <Button type="submit" variant="outline" className="h-14 px-5 border-border bg-card text-foreground text-base rounded-2xl font-extrabold shrink-0" data-testid="btn-manual-lookup">
                    {nfcSupported ? "Enter Manually" : "Look Up Card"}
                  </Button>
                </form>
              </div>
            </div>
          )}

          {checkoutStage === "verify" && posStudent && (
            <div className="p-4 sm:p-6 flex flex-col h-full bg-background overflow-y-auto">
              <Button variant="outline" onClick={() => setCheckoutStage("scan")} className={backBtnClass}><ArrowLeft /> Cancel Payment</Button>

              <div className="flex-1 flex flex-col items-center justify-center py-4">
                <h2 className="text-3xl text-foreground text-center mb-4 sm:mb-6 shrink-0">Verify Student</h2>
                <div className="bg-card rounded-3xl border border-border text-center w-full max-w-md shadow-md overflow-hidden">
                  <div className="on-ink relative bg-ink h-24 sm:h-28 overflow-hidden">
                    <div className="pointer-events-none absolute -top-8 -left-6 h-28 w-28 rounded-full bg-white/[0.07]" />
                    <div className="pointer-events-none absolute -bottom-10 right-4 h-24 w-24 rounded-full bg-gold/15" />
                  </div>
                  <div className="px-5 pb-6 sm:px-8 sm:pb-8 -mt-14 sm:-mt-16 relative">
                    <img src={posStudent.imageUrl} alt={posStudent.name} className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-lilac mx-auto mb-3 border-4 border-card shadow-md object-cover" />
                    <div className="font-display text-3xl sm:text-4xl text-foreground leading-tight mb-2 break-words">{posStudent.name}</div>
                    <span className="inline-block bg-lilac dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full px-4 py-1 text-base font-extrabold mb-6">{posStudent.className}</span>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className={`rounded-2xl p-4 ${posStudent.walletBalance >= cartTotal ? "bg-mint dark:bg-green-900/40" : "bg-blush dark:bg-red-900/40"}`}>
                        <div className={`text-xs tracking-wider font-extrabold mb-1 ${posStudent.walletBalance >= cartTotal ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>Wallet Balance</div>
                        <div className={`text-xl sm:text-2xl font-display tabular-nums break-all ${posStudent.walletBalance >= cartTotal ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>{naira(posStudent.walletBalance)}</div>
                      </div>
                      <div className="bg-muted rounded-2xl p-4">
                        <div className="text-xs text-muted-foreground tracking-wider font-extrabold mb-1">Total Due</div>
                        <div className="text-xl sm:text-2xl font-display text-foreground tabular-nums break-all">{naira(cartTotal)}</div>
                      </div>
                    </div>
                    <Button variant="highlight" onClick={() => setCheckoutStage("pin")} disabled={posStudent.walletBalance < cartTotal} className="w-full h-16 text-xl rounded-2xl shadow-md active:scale-[.98] transition-transform disabled:opacity-60" data-testid="btn-pay">
                      {posStudent.walletBalance < cartTotal ? "Insufficient Balance" : `Pay ${naira(cartTotal)}`}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {checkoutStage === "pin" && (
            <div className="p-4 sm:p-6 flex flex-col h-full bg-background overflow-y-auto">
              <Button variant="outline" onClick={() => setCheckoutStage("verify")} className={backBtnClass}><ArrowLeft /> Back</Button>

              <div className="flex-1 flex flex-col items-center justify-center min-h-max py-4">
                <div className="h-14 w-14 rounded-2xl bg-lilac dark:bg-purple-900/40 flex items-center justify-center mb-3">
                  <Lock className="h-6 w-6 text-purple-700 dark:text-purple-300" />
                </div>
                <h2 className="text-3xl text-foreground text-center mb-1 shrink-0">Enter PIN</h2>
                <p className="text-muted-foreground text-center font-semibold mb-6 sm:mb-8">
                  {posStudent?.name ? `${posStudent.name.split(' ')[0]}, ` : ""}pay <span className="font-display text-foreground">{naira(cartTotal)}</span>
                </p>

                <div className="flex justify-center gap-5 sm:gap-6 mb-6 sm:mb-8">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full transition-all duration-150 ${enteredPin.length > i ? 'bg-gold scale-110 shadow-md shadow-gold/30' : 'bg-muted border-2 border-border'}`} />
                  ))}
                </div>
                {pinError && <p className="text-red-700 dark:text-red-300 text-center text-base sm:text-lg font-extrabold mb-6 bg-blush dark:bg-red-900/40 py-3 px-5 rounded-2xl max-w-[360px]">{pinError}</p>}

                <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-[360px] w-full">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "⌫"].map(d => (
                    <Button
                      key={d}
                      type="button"
                      variant="outline"
                      className={`h-[4.5rem] sm:h-24 text-3xl sm:text-4xl font-display rounded-3xl active:scale-90 transition-all shadow-sm relative z-50 cursor-pointer select-none ${typeof d === "number" ? "bg-card border-border text-foreground hover:bg-accent hover:border-primary/40" : "bg-muted border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (d === "C") setEnteredPin("");
                        else if (d === "⌫") setEnteredPin(prev => prev.slice(0, -1));
                        else if (enteredPin.length < 4) setEnteredPin(prev => prev + String(d));
                      }}
                      onPointerDown={(e) => {
                        // Backup for touch screens if onClick fails
                        if (e.pointerType === 'touch') {
                          e.preventDefault();
                          if (d === "C") setEnteredPin("");
                          else if (d === "⌫") setEnteredPin(prev => prev.slice(0, -1));
                          else if (enteredPin.length < 4) setEnteredPin(prev => prev + String(d));
                        }
                      }}
                    >
                      {d}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="highlight"
                  className="w-full max-w-[360px] h-16 text-xl mt-6 sm:mt-8 rounded-2xl shadow-md transition-transform active:scale-[.98] [&_svg]:size-6"
                  disabled={enteredPin.length !== 4}
                  onClick={handlePinAuth}
                >
                  <ShieldCheck /> Authorize Payment
                </Button>
              </div>
            </div>
          )}

          {checkoutStage === "success" && (
            <div className="relative p-6 sm:p-8 flex flex-col h-full bg-background items-center justify-center text-center overflow-hidden">
              <div className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 rounded-full bg-mint/60 dark:bg-green-900/20" />
              <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-gold/15" />
              <div className="relative w-36 h-36 sm:w-40 sm:h-40 bg-mint dark:bg-green-900/40 rounded-full flex items-center justify-center mb-8">
                <div className="absolute inset-0 rounded-full border-4 border-green-400/40 animate-ping"></div>
                <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-green flex items-center justify-center shadow-lg shadow-green/30">
                  <CheckCircle2 className="w-14 h-14 sm:w-16 sm:h-16 text-white" />
                </div>
              </div>
              <h2 className="relative text-4xl sm:text-5xl text-foreground mb-3 tracking-tight">Payment Successful!</h2>
              <div className="relative font-display text-3xl sm:text-4xl text-green-700 dark:text-green-300 tabular-nums mb-3">{naira(cartTotal)}</div>
              <p className="relative text-xl sm:text-2xl text-muted-foreground font-semibold mb-10 sm:mb-12 max-w-sm">Enjoy your meal, {posStudent?.name.split(' ')[0]}!</p>
              <Button variant="highlight" onClick={resetPos} className="relative w-full max-w-xs h-20 text-2xl rounded-2xl shadow-md transition-transform active:scale-[.98]">
                Next Order
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile floating Pay bar */}
      {!mobileSheetOpen && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-[9998] px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
          {cart.length === 0 ? (
            <div className="pointer-events-auto mx-auto max-w-xl flex items-center justify-center gap-2 text-muted-foreground bg-card border border-border rounded-2xl shadow-md py-4">
              <ShoppingCart className="w-5 h-5" />
              <span className="text-sm font-bold">Tap items to add to order</span>
            </div>
          ) : (
            <div className="on-ink pointer-events-auto mx-auto max-w-xl flex items-center gap-2 bg-ink text-white rounded-2xl shadow-lg p-2">
              <button
                type="button"
                onClick={() => { setCheckoutStage("cart"); setMobileSheetOpen(true); }}
                className="flex items-center gap-3 min-w-0 flex-shrink rounded-xl px-2 py-1.5 min-h-12 hover:bg-white/10 active:scale-95 transition-transform text-left"
                data-testid="btn-mobile-cart"
              >
                <span className="relative h-11 w-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <ShoppingCart className="h-5 w-5" />
                                  </span>
                <span className="flex flex-col min-w-0">
                  <span className="text-[11px] text-lilac/70 tracking-wider font-extrabold whitespace-nowrap">{cartCount} items · View</span>
                  <span className="text-xl font-display leading-tight tabular-nums truncate">{naira(cartTotal)}</span>
                </span>
              </button>
              <Button
                variant="highlight"
                onClick={() => { setCheckoutStage("scan"); setMobileSheetOpen(true); }}
                className="flex-1 h-14 text-lg rounded-xl active:scale-[.98] transition-transform"
                data-testid="btn-mobile-pay"
              >
                Pay Now
              </Button>
            </div>
          )}
        </div>
      )}

      {showExitModal && (
        <div className="fixed inset-0 bg-ink/70 flex items-center justify-center z-[10000] backdrop-blur-sm p-4">
          <div className="bg-card border border-border p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-xl">
            <div className="h-14 w-14 rounded-2xl bg-blush dark:bg-red-900/40 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-red-700 dark:text-red-300" />
            </div>
            <h3 className="font-display text-2xl sm:text-3xl text-foreground mb-2">Exit Kiosk Mode</h3>
            <p className="text-muted-foreground mb-6 text-sm sm:text-base leading-relaxed">
              Enter the password you use to sign in to unlock the terminal.
            </p>
            {exitError && <Alert className="bg-blush dark:bg-red-900/40 border-red-400/40 text-red-700 dark:text-red-300 mb-6 rounded-2xl"><AlertTitle className="text-sm font-extrabold">{exitError}</AlertTitle></Alert>}
            <form onSubmit={(e) => { e.preventDefault(); handleExit(); }}>
              <Input
                type="password"
                value={exitPassword}
                onChange={e => setExitPassword(e.target.value)}
                autoFocus
                className="bg-background border-border text-foreground h-14 mb-6 text-lg text-center tracking-widest rounded-2xl"
                placeholder="••••••••"
              />
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowExitModal(false); setExitPassword(""); setExitError(""); }}
                  className="flex-1 border-border text-foreground h-14 text-base rounded-2xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isExiting || !exitPassword.trim()}
                  className="flex-1 h-14 text-base rounded-2xl"
                >
                  {isExiting ? "Verifying..." : "Unlock"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
