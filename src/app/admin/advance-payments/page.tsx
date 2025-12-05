
'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, query, orderBy, getDocs, doc } from 'firebase/firestore';
import type { Worker, AdvancePayment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Landmark, MoreHorizontal, CheckCircle, Trash2, User } from 'lucide-react';
import { TakaIcon } from '@/components/icons';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/DatePicker';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"


const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('bn-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
  }).format(amount);

function GiveAdvanceDialog({
  isOpen,
  onOpenChange,
  onAdvanceGiven,
  worker,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAdvanceGiven: () => void;
  worker: Worker | null;
}) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [amount, setAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setAmount(0);
      setDate(new Date());
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || amount <= 0 || !worker || !firestore) {
      toast({
        variant: 'destructive',
        title: 'ফর্ম অসম্পূর্ণ',
        description: 'অনুগ্রহ করে তারিখ এবং টাকার পরিমাণ পূরণ করুন।',
      });
      return;
    }
    setIsSubmitting(true);

    const newAdvance: Omit<AdvancePayment, 'id'> = {
      date: date.toISOString(),
      amount,
      workerId: worker.id,
      paidAmount: 0,
      status: 'unpaid',
    };

    try {
      const advanceColRef = collection(firestore, 'workers', worker.id, 'advancePayments');
      await addDocumentNonBlocking(advanceColRef, newAdvance);
      toast({
        title: 'অগ্রিম প্রদান সফল হয়েছে',
        description: `${worker.name}-কে ${formatCurrency(amount)} সফলভাবে প্রদান করা হয়েছে।`,
      });
      
      onAdvanceGiven();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'ত্রুটি',
        description: 'অগ্রিম প্রদান করার সময় একটি সমস্যা হয়েছে।',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>অগ্রিম প্রদান করুন</DialogTitle>
          <DialogDescription>
            {worker?.name}-কে অগ্রিম টাকা প্রদান করুন।
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="date">তারিখ</Label>
            <DatePicker value={date} onSelect={setDate} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">পরিমাণ</Label>
            <Input id="amount" type="number" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} required />
          </div>
          <DialogFooter className="pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'জমা হচ্ছে...' : 'জমা দিন'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddPaymentDialog({
  isOpen,
  onOpenChange,
  onPaymentAdded,
  advance,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentAdded: () => void;
  advance: AdvancePayment | null;
}) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [paymentAmount, setPaymentAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remainingBalance = advance ? (advance.amount || 0) - (advance.paidAmount || 0) : 0;

  useEffect(() => {
    if (!isOpen) {
      setPaymentAmount(0);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0 || !advance || !firestore) {
      toast({ variant: 'destructive', title: 'ফর্ম অসম্পূর্ণ', description: 'অনুগ্রহ করে টাকার পরিমাণ পূরণ করুন।' });
      return;
    }
    if (paymentAmount > remainingBalance) {
        toast({ variant: 'destructive', title: 'অবৈধ পরিমাণ', description: 'পরিশোধের পরিমাণ বকেয়ার চেয়ে বেশি হতে পারবে না।' });
        return;
    }
    setIsSubmitting(true);
    
    const newPaidAmount = (advance.paidAmount || 0) + paymentAmount;
    const newStatus = newPaidAmount >= advance.amount ? 'paid' : 'partially-paid';

    const advanceDocRef = doc(firestore, 'workers', advance.workerId, 'advancePayments', advance.id);
    const updateData = {
        paidAmount: newPaidAmount,
        status: newStatus,
    };

    try {
        await updateDocumentNonBlocking(advanceDocRef, updateData);
        toast({ title: 'পরিশোধ যোগ হয়েছে', description: `${formatCurrency(paymentAmount)} সফলভাবে যোগ করা হয়েছে।` });
        onPaymentAdded();
        onOpenChange(false);
    } catch (error) {
        toast({ variant: 'destructive', title: 'ত্রুটি', description: 'পরিশোধ যোগ করার সময় সমস্যা হয়েছে।' });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>অগ্রিমের কিস্তি পরিশোধ</DialogTitle>
          <DialogDescription>
             {advance?.workerName}-এর {formatCurrency(advance?.amount || 0)} অগ্রিমের জন্য একটি পরিশোধ যোগ করুন।
             <br />
             বর্তমান বকেয়া: <span className='font-bold text-red-500'>{formatCurrency(remainingBalance)}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="paymentAmount">পরিশোধের পরিমাণ</Label>
            <Input id="paymentAmount" type="number" max={remainingBalance} value={paymentAmount || ''} onChange={(e) => setPaymentAmount(Number(e.target.value))} required />
          </div>
          <DialogFooter className="pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'জমা হচ্ছে...' : 'পরিশোধ যোগ করুন'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


export default function AdvancePaymentsPage() {
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const workerIdFromQuery = searchParams.get('workerId');
  const { toast } = useToast();
  
  const [isGiveAdvanceOpen, setIsGiveAdvanceOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [allAdvances, setAllAdvances] = useState<(AdvancePayment & { workerName: string })[]>([]);
  const [workerAdvances, setWorkerAdvances] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [selectedAdvance, setSelectedAdvance] = useState<AdvancePayment | null>(null);
  const [advanceToDelete, setAdvanceToDelete] = useState<AdvancePayment | null>(null);
  const [filteredWorker, setFilteredWorker] = useState<Worker | null>(null);

  const { data: workers, isLoading: isLoadingWorkers } = useCollection<Worker>(
    useMemoFirebase(() => firestore ? query(collection(firestore, 'workers'), orderBy('name')) : null, [firestore])
  );

  useEffect(() => {
    if (workerIdFromQuery && workers) {
        const worker = workers.find(w => w.id === workerIdFromQuery);
        setFilteredWorker(worker || null);
    } else {
        setFilteredWorker(null);
    }
  }, [workerIdFromQuery, workers]);


  const fetchAdvances = useCallback(async () => {
    if (!firestore || !workers) {
      if (workers !== undefined) setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const advances: (AdvancePayment & { workerName: string })[] = [];
      const workerAdvanceMap = new Map<string, number>();
      
      const workersToFetch = workerIdFromQuery ? workers.filter(w => w.id === workerIdFromQuery) : workers;

      for (const worker of workersToFetch) {
        let totalDue = 0;
        const advanceQuery = query(
          collection(firestore, 'workers', worker.id, 'advancePayments'),
          orderBy('date', 'desc')
        );
        const querySnapshot = await getDocs(advanceQuery);
        querySnapshot.forEach(doc => {
          const data = doc.data() as AdvancePayment;
          advances.push({ id: doc.id, workerId: worker.id, workerName: worker.name, ...data });
          const remaining = (data.amount || 0) - (data.paidAmount || 0);
          if (remaining > 0) {
            totalDue += remaining;
          }
        });
        if (!workerIdFromQuery) { // Only populate map if viewing all workers
            workerAdvanceMap.set(worker.id, totalDue);
        }
      }
      setAllAdvances(advances.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setWorkerAdvances(workerAdvanceMap);
    } catch (e) {
      console.error("Failed to fetch advance payments", e);
    } finally {
      setIsLoading(false);
    }
  }, [firestore, workers, workerIdFromQuery]);

  useEffect(() => {
    if (workers) {
      fetchAdvances();
    }
  }, [workers, fetchAdvances]);
  
  const handleDeleteAdvance = () => {
    if (!firestore || !advanceToDelete) return;
    const advanceDocRef = doc(firestore, 'workers', advanceToDelete.workerId, 'advancePayments', advanceToDelete.id);
    deleteDocumentNonBlocking(advanceDocRef);
    toast({
        title: `অগ্রিম মুছে ফেলা হয়েছে`,
        variant: 'destructive',
    });
    setAdvanceToDelete(null);
    fetchAdvances(); // Refetch to update UI
  }


  const handleOpenGiveAdvance = (worker: Worker) => {
    setSelectedWorker(worker);
    setIsGiveAdvanceOpen(true);
  }
  
  const handleOpenAddPayment = (advance: AdvancePayment) => {
    setSelectedAdvance(advance);
    setIsAddPaymentOpen(true);
  }
  
  const getStatusBadge = (status: 'unpaid' | 'partially-paid' | 'paid') => {
      switch(status) {
          case 'paid':
              return <Badge variant="default" className='bg-green-600 hover:bg-green-700'><CheckCircle className="mr-1 h-3 w-3" /> পরিশোধিত</Badge>
          case 'partially-paid':
              return <Badge variant="secondary" className='bg-yellow-500 text-black hover:bg-yellow-600'>আংশিক পরিশোধিত</Badge>
          case 'unpaid':
              return <Badge variant="destructive">অপরিশোধিত</Badge>
          default:
              return <Badge variant="outline">অজানা</Badge>
      }
  }


  return (
    <div className='space-y-6'>
      <GiveAdvanceDialog 
        isOpen={isGiveAdvanceOpen} 
        onOpenChange={setIsGiveAdvanceOpen} 
        onAdvanceGiven={fetchAdvances}
        worker={selectedWorker} 
      />
      <AddPaymentDialog
        isOpen={isAddPaymentOpen}
        onOpenChange={setIsAddPaymentOpen}
        onPaymentAdded={fetchAdvances}
        advance={selectedAdvance}
      />
      <AlertDialog open={!!advanceToDelete} onOpenChange={(open) => !open && setAdvanceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
            <AlertDialogDescription>
              এই পদক্ষেপটি необрати। এটি স্থায়ীভাবে এই অগ্রিমের রেকর্ড মুছে ফেলবে।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল করুন</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAdvance} className="bg-destructive hover:bg-destructive/90">
              মুছে ফেলুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2">
            <Landmark />
             {filteredWorker ? `শ্রমিক: ${filteredWorker.name}` : 'অগ্রিম প্রদান'}
          </CardTitle>
          <CardDescription className="mt-1">
            {filteredWorker 
                ? `${filteredWorker.name}-কে দেওয়া অগ্রিম টাকার হিসাব দেখুন।`
                : 'কর্মীদের অগ্রিম টাকা প্রদান করুন এবং সকল হিসাব দেখুন।'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          {!workerIdFromQuery && (
            <div className="rounded-md border mb-6 w-full">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>কর্মী</TableHead>
                    <TableHead>পদবি</TableHead>
                    <TableHead className="text-right">মোট বকেয়া</TableHead>
                    <TableHead className="text-right">কার্যকলাপ</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(isLoading || isLoadingWorkers) && Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
                    </TableRow>
                    ))}
                    {!isLoading && !isLoadingWorkers && workers?.map(worker => (
                    <TableRow key={worker.id}>
                        <TableCell>
                        <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                            <AvatarImage src={worker.photo} alt={worker.name} />
                            <AvatarFallback>{worker.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{worker.name}</span>
                        </div>
                        </TableCell>
                        <TableCell>{worker.designation}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(workerAdvances.get(worker.id) || 0)}</TableCell>
                        <TableCell className="text-right">
                        <Button onClick={() => handleOpenGiveAdvance(worker)} size="sm">অগ্রিম দিন</Button>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
          )}

          <h3 className="text-lg font-semibold mb-2 mt-6">
            {workerIdFromQuery ? 'অগ্রিম প্রদানের তালিকা' : 'সকল অগ্রিম প্রদানের তালিকা'}
          </h3>
          <div className="rounded-md border w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>তারিখ</TableHead>
                  {!workerIdFromQuery && <TableHead>কর্মী</TableHead>}
                  <TableHead>স্ট্যাটাস</TableHead>
                  <TableHead className="text-right">পরিমাণ</TableHead>
                  <TableHead className="text-right">পরিশোধিত</TableHead>
                  <TableHead className="text-right">বকেয়া</TableHead>
                  <TableHead className="text-center w-[120px]">কার্যকলাপ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    {!workerIdFromQuery && <TableCell><Skeleton className="h-5 w-32" /></TableCell>}
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-8 w-24 mx-auto" /></TableCell>
                  </TableRow>
                ))}
                {!isLoading && allAdvances.length > 0 ? (
                  allAdvances.map((advance) => {
                    const due = (advance.amount || 0) - (advance.paidAmount || 0);
                    return (
                        <TableRow key={advance.id}>
                        <TableCell className="font-medium">{new Date(advance.date).toLocaleDateString('bn-BD')}</TableCell>
                        {!workerIdFromQuery && <TableCell>{advance.workerName}</TableCell>}
                        <TableCell>{getStatusBadge(advance.status)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(advance.amount)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(advance.paidAmount)}</TableCell>
                        <TableCell className="text-right text-red-600 font-bold">{formatCurrency(due)}</TableCell>
                        <TableCell className="text-center">
                            {advance.status !== 'paid' ? (
                                <Button size="sm" variant="outline" onClick={() => handleOpenAddPayment(advance)}>
                                    <TakaIcon className="mr-1 h-4 w-4" /> পরিশোধ
                                </Button>
                            ) : (
                                <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">মেনু খুলুন</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem 
                                        className="text-red-500 focus:text-red-500 focus:bg-red-50"
                                        onClick={() => setAdvanceToDelete(advance)}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        মুছে ফেলুন
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </TableCell>
                        </TableRow>
                    )
                })
                ) : (
                  !isLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        কোনো অগ্রিম প্রদানের রেকর্ড পাওয়া যায়নি।
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
