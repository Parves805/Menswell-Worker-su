
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
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, getDocs, doc } from 'firebase/firestore';
import type { Worker, WorkerExpense } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, PlusCircle, MoreHorizontal, Edit, Trash2, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/DatePicker';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('bn-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
  }).format(amount);

function AddWorkerExpenseDialog({
  isOpen,
  onOpenChange,
  onExpenseAdded,
  expenseToEdit,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onExpenseAdded: () => void;
  expenseToEdit?: WorkerExpense | null;
}) {
  const { toast } = useToast();
  const firestore = useFirestore();
  
  const isEditMode = !!expenseToEdit;

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const workersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'workers'), orderBy('name')) : null),
    [firestore]
  );
  const { data: workers, isLoading: isLoadingWorkers } = useCollection<Worker>(workersQuery);

  const resetForm = () => {
    setDate(new Date());
    setDescription('');
    setAmount('');
    setSelectedWorkerId('');
  };

  useEffect(() => {
      if (isOpen) {
        if (isEditMode && expenseToEdit) {
            setDate(new Date(expenseToEdit.date));
            setDescription(expenseToEdit.description);
            setAmount(expenseToEdit.amount);
            setSelectedWorkerId(expenseToEdit.workerId);
        } else {
            resetForm();
        }
      }
  }, [isOpen, isEditMode, expenseToEdit]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !description || !amount || amount <= 0 || !selectedWorkerId || !firestore) {
      toast({
        variant: 'destructive',
        title: 'ফর্ম অসম্পূর্ণ',
        description: 'অনুগ্রহ করে সমস্ত ঘর পূরণ করুন।',
      });
      return;
    }
    setIsSubmitting(true);

    const worker = workers?.find(w => w.id === selectedWorkerId);
    if (!worker) {
      toast({ variant: 'destructive', title: 'কর্মী পাওয়া যায়নি' });
      setIsSubmitting(false);
      return;
    }

    try {
        if (isEditMode && expenseToEdit) {
            // Update logic
            const expenseDocRef = doc(firestore, 'workers', expenseToEdit.workerId, 'expenses', expenseToEdit.id);
            const updatedExpense = {
                date: date.toISOString(),
                description,
                amount: Number(amount),
            };
            await updateDocumentNonBlocking(expenseDocRef, updatedExpense);
            toast({
                title: 'খরচ আপডেট হয়েছে',
                description: `${worker.name}-এর খরচ সফলভাবে আপডেট করা হয়েছে।`,
            });
        } else {
            // Create logic
             const newExpense: Omit<WorkerExpense, 'id'> = {
                date: date.toISOString(),
                description,
                amount: Number(amount),
                workerId: selectedWorkerId,
                workerName: worker.name,
            };
            const expenseColRef = collection(firestore, 'workers', selectedWorkerId, 'expenses');
            await addDocumentNonBlocking(expenseColRef, newExpense);
            toast({
                title: 'খরচ প্রদান সফল',
                description: `${worker.name}-কে ${formatCurrency(Number(amount))} টাকা (${description}) প্রদান করা হয়েছে।`,
            });
        }
      
      resetForm();
      onExpenseAdded();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'ত্রুটি',
        description: 'খরচ যোগ বা আপডেট করার সময় একটি সমস্যা হয়েছে।',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'কর্মীর খরচ সম্পাদনা করুন' : 'কর্মীর খরচ যোগ করুন'}</DialogTitle>
          <DialogDescription>{isEditMode ? `"${expenseToEdit?.workerName}"-এর খরচের বিবরণ পরিবর্তন করুন।` : 'একজন কর্মীর জন্য একটি নতুন খরচ যোগ করুন (যেমন: যাতায়াত, চিকিৎসা)।'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="worker">কর্মী</Label>
            <Select name="worker" required onValueChange={setSelectedWorkerId} value={selectedWorkerId} disabled={isEditMode}>
              <SelectTrigger id="worker">
                <SelectValue placeholder="কর্মী নির্বাচন করুন" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingWorkers ? (
                  <SelectItem value="loading" disabled>লোড হচ্ছে...</SelectItem>
                ) : (
                  workers?.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">তারিখ</Label>
            <DatePicker value={date} onSelect={setDate} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">বিবরণ</Label>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., যাতায়াত ভাড়া" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">পরিমাণ</Label>
            <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} required />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>বাতিল করুন</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'প্রসেসিং...' : (isEditMode ? 'পরিবর্তন সংরক্ষণ করুন' : 'খরচ যোগ করুন')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function WorkerExpensesPage() {
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const workerIdFromQuery = searchParams.get('workerId');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<WorkerExpense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<WorkerExpense | null>(null);
  const [allExpenses, setAllExpenses] = useState<WorkerExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filteredWorker, setFilteredWorker] = useState<Worker | null>(null);
  const { toast } = useToast();

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

  const fetchExpenses = useCallback(async () => {
    if (!firestore || !workers) {
      if (workers !== undefined) setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const expenses: WorkerExpense[] = [];
      const workersToFetch = workerIdFromQuery ? workers.filter(w => w.id === workerIdFromQuery) : workers;

      for (const worker of workersToFetch) {
        const expenseQuery = query(
          collection(firestore, 'workers', worker.id, 'expenses'),
          orderBy('date', 'desc')
        );
        const querySnapshot = await getDocs(expenseQuery);
        querySnapshot.forEach(doc => {
          expenses.push({ id: doc.id, ...doc.data() } as WorkerExpense);
        });
      }
      setAllExpenses(expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (e) {
      console.error("Failed to fetch worker expenses", e);
    } finally {
      setIsLoading(false);
    }
  }, [firestore, workers, workerIdFromQuery]);

  useEffect(() => {
    if (workers) {
      fetchExpenses();
    }
  }, [workers, fetchExpenses]);
  
  const handleOpenDialog = (expense?: WorkerExpense) => {
    setExpenseToEdit(expense || null);
    setIsDialogOpen(true);
  }

  const handleDeleteExpense = () => {
    if (!firestore || !expenseToDelete) return;
    const expenseDocRef = doc(firestore, 'workers', expenseToDelete.workerId, 'expenses', expenseToDelete.id);
    deleteDocumentNonBlocking(expenseDocRef)
        .then(() => {
            toast({
                title: 'খরচ মুছে ফেলা হয়েছে',
                description: `${expenseToDelete.workerName}-এর খরচটি সফলভাবে মুছে ফেলা হয়েছে।`,
                variant: 'destructive',
            });
            fetchExpenses(); // Refresh the list
        })
        .catch(() => {
            toast({ variant: 'destructive', title: 'ত্রুটি', description: 'খরচটি মুছে ফেলার সময় একটি সমস্যা হয়েছে।' });
        })
        .finally(() => {
            setExpenseToDelete(null);
        });
  };


  const grandTotal = useMemo(() => {
    return allExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  }, [allExpenses]);

  return (
    <>
      <AddWorkerExpenseDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onExpenseAdded={fetchExpenses}
        expenseToEdit={expenseToEdit}
      />
       <AlertDialog open={!!expenseToDelete} onOpenChange={() => setExpenseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
            <AlertDialogDescription>
              এই পদক্ষেপটি необрати। এটি স্থায়ীভাবে এই খরচের রেকর্ড মুছে ফেলবে।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল করুন</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense} className="bg-destructive hover:bg-destructive/90">
              মুছে ফেলুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 p-4 md:p-6">
          <div>
            <CardTitle className="flex items-center gap-2">
                <Wallet /> 
                {filteredWorker ? `শ্রমিক: ${filteredWorker.name}` : 'কর্মীর খরচ'}
            </CardTitle>
            <CardDescription className="mt-1">
                {filteredWorker 
                    ? `${filteredWorker.name}-কে প্রদান করা সমস্ত খরচের হিসাব দেখুন।`
                    : 'কর্মীদের প্রদান করা সমস্ত খরচের হিসাব দেখুন এবং নতুন খরচ যোগ করুন।'
                }
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()} className="w-full md:w-auto" size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            খরচ যোগ করুন
          </Button>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          <div className="rounded-md border w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>তারিখ</TableHead>
                  {!workerIdFromQuery && <TableHead>কর্মী</TableHead>}
                  <TableHead>বিবরণ</TableHead>
                  <TableHead className="text-right">পরিমাণ</TableHead>
                  <TableHead className="text-right w-[100px]">কার্যকলাপ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isLoading || isLoadingWorkers) && Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    {!workerIdFromQuery && <TableCell><Skeleton className="h-5 w-32" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))}
                {!isLoading && allExpenses.length > 0 ? (
                  allExpenses.map((expense) => {
                    const worker = workers?.find(w => w.id === expense.workerId);
                    return (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">{new Date(expense.date).toLocaleDateString('bn-BD')}</TableCell>
                        {!workerIdFromQuery && (
                           <TableCell>
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 hidden sm:flex">
                                <AvatarImage src={worker?.photo} alt={expense.workerName} />
                                <AvatarFallback>{expense.workerName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{expense.workerName}</span>
                            </div>
                           </TableCell>
                        )}
                        <TableCell>{expense.description}</TableCell>
                        <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                        <TableCell className="text-right">
                           <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">মেনু খুলুন</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleOpenDialog(expense)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        সম্পাদনা করুন
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                        className="text-red-500 focus:text-red-500 focus:bg-red-50"
                                        onClick={() => setExpenseToDelete(expense)}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        মুছে ফেলুন
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  !isLoading && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        কোনো খরচের রেকর্ড পাওয়া যায়নি।
                      </TableCell>
                    </TableRow>
                  )
                )}
                {!isLoading && allExpenses.length > 0 && (
                  <TableRow className="font-bold bg-muted">
                    <TableCell colSpan={workerIdFromQuery ? 2 : 3} className="text-right">সর্বমোট</TableCell>
                    <TableCell className="text-right text-primary" colSpan={2}>{formatCurrency(grandTotal)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
