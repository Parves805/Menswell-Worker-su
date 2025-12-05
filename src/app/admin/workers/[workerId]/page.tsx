
'use client';

import React, { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { Briefcase, Calendar, Phone, Scissors, Wallet2, CircleDollarSign } from 'lucide-react';
import { TakaIcon } from '@/components/icons';
import { Separator } from '@/components/ui/separator';
import { doc, collection, query } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import type { Worker, ProductionEntry, AdvancePayment, WorkerExpense } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('bn-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
  }).format(amount);

function StatCard({ icon, label, value, valueClassName }: { icon: React.ReactNode, label: string, value: string | number, valueClassName?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-background p-4 shadow-sm transition-all hover:shadow-md">
      <div className="rounded-lg bg-muted p-3">{icon}</div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold ${valueClassName}`}>{value}</p>
      </div>
    </div>
  );
}

export default function WorkerProfilePage() {
  const firestore = useFirestore();
  const params = useParams();
  const workerId = params.workerId as string;

  const workerDocRef = useMemoFirebase(() => {
    if (!firestore || !workerId) return null;
    return doc(firestore, 'workers', workerId);
  }, [firestore, workerId]);

  const productionQuery = useMemoFirebase(() => 
    firestore && workerId ? query(collection(firestore, 'workers', workerId, 'productionEntries')) : null, 
    [firestore, workerId]
  );
  const advancesQuery = useMemoFirebase(() => 
    firestore && workerId ? query(collection(firestore, 'workers', workerId, 'advancePayments')) : null, 
    [firestore, workerId]
  );
  const expensesQuery = useMemoFirebase(() => 
    firestore && workerId ? query(collection(firestore, 'workers', workerId, 'expenses')) : null, 
    [firestore, workerId]
  );


  const { data: workerData, isLoading: isLoadingWorker } = useDoc<Worker>(workerDocRef);
  const { data: productionEntries, isLoading: isLoadingProduction } = useCollection<ProductionEntry>(productionQuery);
  const { data: advances, isLoading: isLoadingAdvances } = useCollection<AdvancePayment>(advancesQuery);
  const { data: expenses, isLoading: isLoadingExpenses } = useCollection<WorkerExpense>(expensesQuery);

  const totalProduction = useMemo(() => {
    if (!productionEntries) return 0;
    return productionEntries.reduce((sum, entry) => sum + (entry.pieceCount || 0), 0);
  }, [productionEntries]);
  
  const totalEarnings = useMemo(() => {
    if (!productionEntries) return 0;
    return productionEntries.reduce((sum, entry) => sum + (entry.total || 0), 0);
  }, [productionEntries]);

  const totalExpenses = useMemo(() => {
    if (!expenses) return 0;
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);
  
  const totalAdvanceDue = useMemo(() => {
    if (!advances) return 0;
    return advances.reduce((sum, advance) => {
        const remaining = (advance.amount || 0) - (advance.paidAmount || 0);
        return sum + (remaining > 0 ? remaining : 0);
    }, 0);
  }, [advances]);

  const isLoadingStats = isLoadingProduction || isLoadingAdvances || isLoadingExpenses;

  if (isLoadingWorker) {
    return (
        <Card>
            <CardHeader className="flex flex-col items-center gap-4 text-center">
                <Skeleton className="h-32 w-32 rounded-full" />
                <div className='space-y-2'>
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-5 w-32" />
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <Skeleton className="h-px w-full" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <Skeleton className="h-20 w-full" />
                   <Skeleton className="h-20 w-full" />
                   <Skeleton className="h-20 w-full" />
                   <Skeleton className="h-20 w-full" />
                </div>
            </CardContent>
        </Card>
    );
  }
  
  if (!workerData) {
      return <p>কর্মী খুঁজে পাওয়া যায়নি।</p>
  }


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col items-center gap-4 text-center">
            <Avatar className="h-32 w-32 border-4 border-primary/20 shadow-lg">
                <AvatarImage src={workerData.photo} alt={workerData.name} />
                <AvatarFallback className="text-4xl">{workerData.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
                <CardTitle className="text-3xl">{workerData.name}</CardTitle>
                <CardDescription className="text-base">{workerData.designation}</CardDescription>
            </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Separator />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="flex items-center gap-3 text-muted-foreground p-3 bg-muted/50 rounded-lg">
                <Briefcase className="h-5 w-5 text-primary"/>
                <span>বিভাগ: <span className="font-medium text-foreground">{workerData.department}</span></span>
            </div>
             <div className="flex items-center gap-3 text-muted-foreground p-3 bg-muted/50 rounded-lg">
                <Calendar className="h-5 w-5 text-primary"/>
                <span>যোগদান: <span className="font-medium text-foreground">{new Date(workerData.joinDate).toLocaleDateString('bn-BD')}</span></span>
            </div>
             <div className="flex items-center gap-3 text-muted-foreground p-3 bg-muted/50 rounded-lg">
                <Phone className="h-5 w-5 text-primary"/>
                <span>মোবাইল: <span className="font-medium text-foreground">{workerData.contact}</span></span>
            </div>
          </div>

        </CardContent>
      </Card>

      <Card>
          <CardHeader>
              <CardTitle>কাজের সারসংক্ষেপ</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {isLoadingStats ? (
                  <>
                    <Skeleton className='h-24' />
                    <Skeleton className='h-24' />
                    <Skeleton className='h-24' />
                    <Skeleton className='h-24' />
                  </>
                ) : (
                  <>
                    <StatCard 
                        icon={<Scissors className="h-8 w-8 text-primary" />}
                        label="মোট সেলাই"
                        value={`${totalProduction.toLocaleString('bn-BD')} পিস`}
                    />
                    <StatCard 
                        icon={<CircleDollarSign className="h-8 w-8 text-primary" />}
                        label="মোট আয়"
                        value={formatCurrency(totalEarnings)}
                    />
                    <StatCard 
                        icon={<Wallet2 className="h-8 w-8 text-primary" />}
                        label="মোট খরচ"
                        value={formatCurrency(totalExpenses)}
                    />
                    <StatCard 
                        icon={<TakaIcon className="h-8 w-8 text-destructive" />}
                        label="মোট বকেয়া অগ্রিম"
                        value={formatCurrency(totalAdvanceDue)}
                        valueClassName='text-destructive'
                    />
                  </>
                )}
          </CardContent>
      </Card>

    </div>
  );
}
