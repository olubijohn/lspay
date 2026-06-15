import { useState, useEffect } from "react";
import { useStore } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { ShoppingCart, Plus, Minus, CreditCard, X, CheckCircle2, Image as ImageIcon, Wifi, ChevronDown } from "lucide-react";
import { InventoryItem, Student } from "@/lib/types";
import { useNfcScanner } from "@/lib/useNfcScanner";
import { QrScanner } from "@/components/QrScanner";
import { QrCode } from "lucide-react";

export function TenantKiosk({ tenantId, onExit }: { tenantId: number, onExit: () => void }) {
  const { inventory, students, tenants, transactions, deductBalanceAndStock, addTransaction, addStockMovement, addNotification, session } = useStore();
  
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

  const updateCartQty = (id: number, delta: number) => {
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
    if (!student.parentEmail) return;
    addNotification({
      targetRole: "parent",
      targetTenantId: student.tenantId,
      targetParentEmail: student.parentEmail,
      type: "limit_exceeded",
      message: `${student.name} attempted a ₦${cartTotal.toFixed(2)} purchase at ${activeTenant?.name ?? "the canteen"}, which would exceed their ${kind} spending limit of ₦${limit.toFixed(2)} (₦${alreadySpent.toFixed(2)} already spent ${kind === "daily" ? "today" : "this month"}). The purchase was declined.`,
      studentId: student.id,
      studentName: student.name,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  };

  const handlePinAuth = () => {
    setPinError("");
    if (!posStudent) return;
    if (posStudent.pin !== enteredPin) {
      setPinError("Incorrect PIN.");
      setEnteredPin("");
      return;
    }
    if (posStudent.walletBalance < cartTotal) {
      setPinError(`Insufficient funds. Balance: ₦${posStudent.walletBalance.toFixed(2)}`);
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
      setPinError(`Daily limit of ₦${posStudent.dailyLimit.toFixed(2)} would be exceeded (₦${spentToday.toFixed(2)} already spent today). The parent has been notified.`);
      setEnteredPin("");
      return;
    }
    if (spentMonth + cartTotal > posStudent.monthlyLimit) {
      notifyLimitBreach(posStudent, "monthly", posStudent.monthlyLimit, spentMonth);
      setPinError(`Monthly limit of ₦${posStudent.monthlyLimit.toFixed(2)} would be exceeded (₦${spentMonth.toFixed(2)} already spent this month). The parent has been notified.`);
      setEnteredPin("");
      return;
    }

    // Success
    const itemsString = cart.map(c => `${c.item.name} x${c.qty}`).join(", ");
    const today = new Date().toISOString().split("T")[0];
    
    deductBalanceAndStock(posStudent.id, cartTotal, cart.map(c => ({ id: c.item.id, qty: c.qty })));
    
    cart.forEach(c => {
      addStockMovement({
        tenantId,
        itemId: c.item.id,
        itemName: c.item.name,
        date: today,
        type: 'sale',
        quantity: c.qty
      });
    });

    addTransaction({
      tenantId,
      studentId: posStudent.id,
      studentName: posStudent.name,
      schoolName: activeTenant?.name || "",
      itemsString,
      amount: cartTotal,
      cost: cartCost,
      date: today
    });
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

  const handleExit = () => {
    if (session.user?.passwordHash === exitPassword) {
      try {
        if (document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      } catch(e) {}
      onExit();
    } else {
      setExitError("Incorrect password. Access denied.");
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col font-sans h-screen w-screen overflow-hidden">
      {/* Top Header */}
      <div className="bg-card border-b border-border p-3 sm:p-4 flex justify-between items-center shadow-md z-10">
        <Button variant="ghost" size="sm" onClick={() => setShowExitModal(true)} className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 px-2 sm:px-4">
          <X className="h-5 w-5 sm:mr-2" /> <span className="hidden sm:inline">Exit Kiosk</span>
        </Button>
        <div className="text-sm sm:text-xl font-black text-foreground tracking-wider uppercase text-center flex-1 px-2 leading-tight">{activeTenant?.name} POS Terminal</div>
        <div className="text-primary font-mono font-bold text-xs sm:text-xl shrink-0">{new Date().toLocaleTimeString()}</div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Digital Menu (Left 2/3) */}
        <div className="flex-1 lg:flex-[2] bg-background p-4 lg:p-6 flex flex-col h-full overflow-hidden">
          <div className="overflow-y-auto pr-1 lg:pr-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6 flex-1 content-start pb-44 lg:pb-20 scrollbar-hide">
            {tenantInventory.map(item => (
              <Card 
                key={item.id} 
                onClick={() => addToCart(item)} 
                className={`cursor-pointer border-border transition-all flex flex-col overflow-hidden shadow-lg h-auto min-h-[220px] ${item.stock > 0 ? 'bg-card hover:border-primary hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:-translate-y-1' : 'bg-card/40 opacity-50 cursor-not-allowed'}`}
              >
                <div className="h-28 sm:h-36 bg-white relative shrink-0">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain p-2" onError={(e) => { e.currentTarget.style.display='none'; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}
                  {item.stock < 10 && item.stock > 0 && (
                    <div className="absolute top-2 right-2 bg-amber-500 text-black text-xs font-bold px-2 py-1 rounded shadow">Low Stock</div>
                  )}
                  {item.stock <= 0 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
                      <span className="bg-red-500 text-white font-bold px-4 py-2 rounded shadow-lg transform -rotate-12">OUT OF STOCK</span>
                    </div>
                  )}
                </div>
                <CardContent className="p-4 flex flex-col justify-between flex-1">
                  <div>
                    <Badge variant="outline" className="bg-background border-border text-muted-foreground mb-2 text-[10px] uppercase tracking-wider">{item.category}</Badge>
                    <h3 className="font-bold text-foreground leading-tight line-clamp-2 text-lg">{item.name}</h3>
                  </div>
                  <div className="flex justify-between items-end mt-4 pt-4 border-t border-border/50">
                    <span className="text-primary font-black text-2xl">₦{item.sellingPrice.toFixed(2)}</span>
                    <span className="text-sm font-medium text-muted-foreground">Qty: {item.stock}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Cart Sidebar (desktop) / Checkout overlay (mobile) */}
        <div className={`bg-card border-border flex-col h-full shadow-[-20px_0_30px_rgba(0,0,0,0.3)] lg:flex lg:flex-[1] lg:static lg:border-l lg:z-10 ${mobileSheetOpen ? 'flex fixed inset-0 z-[10000]' : 'hidden'}`}>
          {checkoutStage === "cart" && (
            <>
              <div className="p-6 border-b border-border flex justify-between items-center bg-background">
                <h2 className="font-bold text-foreground text-2xl flex items-center"><ShoppingCart className="mr-3 text-primary" /> Current Order</h2>
                <div className="flex items-center gap-3">
                  <Badge className="bg-primary text-lg px-3 py-1 font-bold">{cart.length} items</Badge>
                  <Button variant="ghost" size="icon" className="lg:hidden text-muted-foreground hover:text-foreground h-10 w-10" onClick={() => setMobileSheetOpen(false)} data-testid="btn-mobile-close"><ChevronDown className="h-6 w-6" /></Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                    <ShoppingCart className="w-20 h-20 mb-4" />
                    <p className="text-xl">Tap items to add to order</p>
                  </div>
                ) : (
                  cart.map(c => (
                    <div key={c.item.id} className="flex flex-col p-4 bg-background border border-border rounded-xl shadow-sm">
                      <div className="flex justify-between mb-3">
                        <div className="font-bold text-foreground text-lg truncate pr-2">{c.item.name}</div>
                        <div className="text-primary font-bold text-lg">₦{(c.item.sellingPrice * c.qty).toFixed(2)}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">₦{c.item.sellingPrice.toFixed(2)} each</span>
                        <div className="flex items-center space-x-3 bg-card rounded-lg p-1 border border-border">
                          <Button variant="ghost" size="icon" className="h-10 w-10 text-foreground hover:bg-muted active:scale-90" onClick={() => updateCartQty(c.item.id, -1)}><Minus className="h-5 w-5" /></Button>
                          <span className="w-8 text-center text-foreground font-bold text-xl">{c.qty}</span>
                          <Button variant="ghost" size="icon" className="h-10 w-10 text-foreground hover:bg-muted active:scale-90" onClick={() => updateCartQty(c.item.id, 1)}><Plus className="h-5 w-5" /></Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 border-t border-border bg-background shadow-[0_-10px_20px_rgba(0,0,0,0.2)]">
                <div className="flex justify-between items-end mb-6">
                  <span className="text-muted-foreground text-xl font-medium uppercase tracking-wider">Total Due</span>
                  <span className="text-6xl font-black text-primary tracking-tighter">₦{cartTotal.toFixed(2)}</span>
                </div>
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-white h-20 text-2xl font-bold rounded-xl shadow-lg shadow-primary/50 transition-transform active:scale-95 disabled:opacity-50"
                  disabled={cart.length === 0}
                  onClick={() => setCheckoutStage("scan")}
                >
                  Pay Now
                </Button>
                <Button variant="ghost" className="w-full mt-4 text-muted-foreground h-12 font-bold" onClick={resetPos} disabled={cart.length === 0}>
                  Cancel Order
                </Button>
              </div>
            </>
          )}

          {checkoutStage === "scan" && (
            <div className="p-4 sm:p-8 flex flex-col h-full bg-background overflow-y-auto">
              <Button variant="outline" onClick={() => setCheckoutStage("cart")} className="w-max border-border text-foreground mb-4 sm:mb-8 h-12 px-6 rounded-full font-bold shrink-0">← Back to Order</Button>
              <div className="bg-blue-600 text-white px-4 py-3 rounded-xl text-sm sm:text-base font-medium text-center mb-4 max-w-md mx-auto shadow-md">
                {!nfcSupported
                  ? "NFC not available on this device. Please enter the Hardware ID below."
                  : nfcStatus === "scanning"
                    ? "Hold the card flat against the back of the device…"
                    : "Please scan the student's card or enter their Hardware ID below."}
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-foreground text-center mb-8">Scan Student Card</h2>

              <div className="flex-1 flex flex-col items-center justify-center">
                <div className={`w-64 h-64 rounded-full bg-card border-[8px] flex items-center justify-center mb-10 relative ${nfcStatus === "scanning" ? "border-primary animate-pulse shadow-[0_0_80px_rgba(16,185,129,0.25)]" : "border-border"}`}>
                  {nfcStatus === "scanning" && <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping"></div>}
                  <CreditCard className={`w-32 h-32 ${nfcStatus === "scanning" ? "text-primary" : "text-muted-foreground"}`} />
                </div>

                {scanError && <Alert className="bg-red-900/30 border-red-500 text-red-400 mb-6 w-full max-w-md"><AlertTitle className="text-center text-lg">{scanError}</AlertTitle></Alert>}
                {nfcSupported && nfcError && <Alert className="bg-red-900/30 border-red-500 text-red-400 mb-6 w-full max-w-md"><AlertTitle className="text-center text-base">{nfcError}</AlertTitle></Alert>}

                <div className="w-full max-w-sm space-y-3 mb-6">
                  {nfcSupported && (
                    <Button
                      type="button"
                      onClick={startNfc}
                      className="w-full bg-primary hover:bg-primary/90 text-white h-16 text-xl rounded-xl font-bold active:scale-95 transition-transform"
                      data-testid="btn-scan-card"
                    >
                      <Wifi className="mr-3 h-6 w-6" />
                      {nfcStatus === "scanning" ? "Scanning… Tap Card" : "Scan NFC Card"}
                    </Button>
                  )}
                  <QrScanner
                    triggerClassName="w-full bg-primary hover:bg-primary/90 text-white h-16 text-xl rounded-xl font-bold active:scale-95 transition-transform border-0"
                    onResult={(text) => { lookupCard(text); }}
                  >
                    <QrCode className="mr-3 h-6 w-6" /> Scan QR Card
                  </QrScanner>
                </div>

                <form onSubmit={handleScan} className="w-full max-w-sm space-y-3">
                  <Input 
                    type="password"
                    value={scanInput} 
                    onChange={e => setScanInput(e.target.value)} 
                    placeholder={nfcSupported ? "Or enter Hardware ID manually" : "Hardware ID (NFC-9982)"}
                    className="bg-card border-border text-foreground text-center h-14 text-lg rounded-xl font-mono tracking-widest"
                  />
                  <Button type="submit" variant="outline" className="w-full border-border text-foreground h-12 text-base rounded-xl font-bold" data-testid="btn-manual-lookup">
                    {nfcSupported ? "Enter Manually" : "Look Up Card"}
                  </Button>
                </form>
              </div>
            </div>
          )}

          {checkoutStage === "verify" && posStudent && (
            <div className="p-4 sm:p-8 flex flex-col h-full bg-background overflow-y-auto">
              <Button variant="outline" onClick={() => setCheckoutStage("scan")} className="w-max border-border text-foreground mb-4 sm:mb-8 h-12 px-6 rounded-full font-bold shrink-0">← Cancel Payment</Button>
              <h2 className="text-3xl font-bold text-foreground text-center mb-4 sm:mb-8 shrink-0">Verify Student</h2>
              
              <div className="flex-1 flex flex-col items-center">
                <div className="bg-card p-6 sm:p-8 rounded-3xl border border-border text-center w-full max-w-md shadow-2xl mb-auto mt-2 sm:mt-8">
                  <img src={posStudent.imageUrl} alt={posStudent.name} className="w-28 h-28 sm:w-40 sm:h-40 rounded-full bg-background mx-auto mb-4 sm:mb-6 border-4 border-border shadow-inner" />
                  <div className="text-4xl font-black text-foreground mb-2">{posStudent.name}</div>
                  <div className="text-xl text-muted-foreground mb-6 font-medium">{posStudent.className}</div>
                  <div className="grid grid-cols-2 gap-3 mb-8">
                    <div className="bg-background rounded-2xl border border-border p-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Wallet Balance</div>
                      <div className={`text-2xl font-black ${posStudent.walletBalance >= cartTotal ? "text-foreground" : "text-red-400"}`}>₦{posStudent.walletBalance.toFixed(2)}</div>
                    </div>
                    <div className="bg-background rounded-2xl border border-border p-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Due</div>
                      <div className="text-2xl font-black text-primary">₦{cartTotal.toFixed(2)}</div>
                    </div>
                  </div>
                  <Button onClick={() => setCheckoutStage("pin")} disabled={posStudent.walletBalance < cartTotal} className="w-full bg-primary hover:bg-primary/90 text-white h-16 text-xl font-bold rounded-xl shadow-lg shadow-primary/30 active:scale-95 transition-transform disabled:opacity-50" data-testid="btn-pay">
                    {posStudent.walletBalance < cartTotal ? "Insufficient Balance" : `Pay ₦${cartTotal.toFixed(2)}`}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {checkoutStage === "pin" && (
            <div className="p-4 sm:p-8 flex flex-col h-full bg-background overflow-y-auto">
              <Button variant="outline" onClick={() => setCheckoutStage("verify")} className="w-max border-border text-foreground mb-4 sm:mb-8 h-12 px-6 rounded-full font-bold shrink-0">← Back</Button>
              <h2 className="text-3xl font-bold text-foreground text-center mb-6 sm:mb-12 shrink-0">Enter PIN</h2>
              
              <div className="flex-1 flex flex-col items-center justify-center min-h-max py-2">
                <div className="flex justify-center space-x-6 mb-6 sm:mb-12">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`w-6 h-6 rounded-full transition-colors ${enteredPin.length > i ? 'bg-primary shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'bg-muted'}`} />
                  ))}
                </div>
                {pinError && <p className="text-red-400 text-center text-base sm:text-lg font-medium mb-6 sm:mb-8 bg-red-950/50 py-3 px-6 rounded-2xl border border-red-900">{pinError}</p>}
                
                <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-[340px] w-full">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "⌫"].map(d => (
                    <Button 
                      key={d} 
                      type="button"
                      variant="outline" 
                      className="h-16 sm:h-24 text-3xl sm:text-4xl font-black bg-card border-border text-foreground hover:bg-muted hover:border-primary/50 hover:text-primary rounded-2xl active:scale-90 transition-all shadow-sm relative z-50 cursor-pointer"
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
                  className="w-full max-w-[340px] bg-primary hover:bg-primary/90 text-white h-14 sm:h-16 text-xl font-bold mt-6 sm:mt-8 rounded-xl shadow-lg shadow-primary/30 transition-transform active:scale-95" 
                  disabled={enteredPin.length !== 4}
                  onClick={handlePinAuth}
                >
                  Authorize Payment
                </Button>
              </div>
            </div>
          )}

          {checkoutStage === "success" && (
            <div className="p-8 flex flex-col h-full bg-background items-center justify-center text-center">
              <div className="w-40 h-40 bg-primary/30 rounded-full flex items-center justify-center mb-10 border-4 border-primary/30 relative">
                <div className="absolute inset-0 rounded-full border-4 border-primary/50 animate-ping"></div>
                <CheckCircle2 className="w-20 h-20 text-primary" />
              </div>
              <h2 className="text-5xl font-black text-foreground mb-4 tracking-tight">Payment Successful!</h2>
              <p className="text-2xl text-muted-foreground mb-16 max-w-sm">Enjoy your meal, {posStudent?.name.split(' ')[0]}!</p>
              <Button onClick={resetPos} className="w-full max-w-xs bg-primary hover:bg-primary/90 text-white h-20 text-2xl font-bold rounded-xl shadow-[0_0_40px_rgba(16,185,129,0.3)] transition-transform active:scale-95">
                Next Order
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile floating Pay bar */}
      {!mobileSheetOpen && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-[9998] bg-card border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.45)]">
          {cart.length === 0 ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground py-3">
              <ShoppingCart className="w-5 h-5" />
              <span className="text-sm font-medium">Tap items to add to order</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setCheckoutStage("cart"); setMobileSheetOpen(true); }}
                className="flex flex-col items-start flex-shrink-0 px-2 active:scale-95 transition-transform"
                data-testid="btn-mobile-cart"
              >
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{cart.reduce((n, c) => n + c.qty, 0)} items</span>
                <span className="text-2xl font-black text-primary leading-none">₦{cartTotal.toFixed(2)}</span>
              </button>
              <Button
                onClick={() => { setCheckoutStage("scan"); setMobileSheetOpen(true); }}
                className="flex-1 bg-primary hover:bg-primary/90 text-white h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/40 active:scale-95 transition-transform"
                data-testid="btn-mobile-pay"
              >
                Pay Now
              </Button>
            </div>
          )}
        </div>
      )}

      {showExitModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[10000] backdrop-blur-sm">
          <div className="bg-card border border-border p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h3 className="text-3xl font-black text-foreground mb-2">Exit Kiosk Mode</h3>
            <p className="text-muted-foreground mb-8 text-lg">Enter your password to unlock the terminal.</p>
            {exitError && <Alert className="bg-red-900/30 border-red-500 text-red-400 mb-6"><AlertTitle>{exitError}</AlertTitle></Alert>}
            <Input type="password" value={exitPassword} onChange={e => setExitPassword(e.target.value)} className="bg-background border-border text-foreground h-14 mb-8 text-lg text-center tracking-widest" placeholder="••••••••" />
            <div className="flex gap-4">
              <Button variant="ghost" onClick={() => {setShowExitModal(false); setExitPassword(""); setExitError("");}} className="flex-1 text-foreground h-14 text-lg font-bold">Cancel</Button>
              <Button onClick={handleExit} className="flex-1 bg-red-600 hover:bg-red-700 text-white h-14 text-lg font-bold rounded-xl">Unlock</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
