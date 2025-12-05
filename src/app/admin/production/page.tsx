
'use client';

import React, { useCallback, useMemo, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, User } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import type { Worker, ProductionEntry as ProductionEntryType } from '@/lib/types';
import { AddProductionEntryDialog } from '@/components/admin/AddProductionEntryDialog';
import { Skeleton } from '@/components/ui/skeleton';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('bn-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
  }).format(amount);


export default function ProductionPage() {
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const workerIdFromQuery = searchParams.get('workerId');

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [productionEntries, setProductionEntries] = React.useState<ProductionEntryType[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [filteredWorker, setFilteredWorker] = React.useState<Worker | null>(null);

  const workersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'workers'), orderBy('name')) : null),
    [firestore]
  );
  const { data: workers } = useCollection<Worker>(workersQuery);
  
  useEffect(() => {
      if (workerIdFromQuery && workers) {
          const worker = workers.find(w => w.id === workerIdFromQuery);
          setFilteredWorker(worker || null);
      } else {
          setFilteredWorker(null);
      }
  }, [workerIdFromQuery, workers]);

  const fetchProductionEntries = useCallback(async () => {
    if (!firestore || !workers) {
      if(workers !== undefined) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const allEntries: ProductionEntryType[] = [];
      const workersToFetch = workerIdFromQuery ? workers.filter(w => w.id === workerIdFromQuery) : workers;

      for (const worker of workersToFetch) {
        const entriesQuery = query(collection(firestore, 'workers', worker.id, 'productionEntries'));
        const querySnapshot = await getDocs(entriesQuery);
        querySnapshot.forEach(doc => {
          const data = doc.data();
          allEntries.push({
            id: doc.id,
            workerId: worker.id,
            ...data,
          } as ProductionEntryType);
        });
      }
      setProductionEntries(allEntries.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch(e) {
      console.error("Failed to fetch production entries", e);
    } finally {
      setIsLoading(false);
    }
  }, [firestore, workers, workerIdFromQuery]);


  React.useEffect(() => {
    fetchProductionEntries();
  }, [fetchProductionEntries]);

  const handleEntryAdded = () => {
    fetchProductionEntries();
  };

  return (
    <>
      <AddProductionEntryDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onEntryAdded={handleEntryAdded}
      />
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 p-4 md:p-6">
          <div>
            <CardTitle className='flex items-center gap-2'>
                {filteredWorker && <User className="h-5 w-5 text-muted-foreground" />}
                {filteredWorker ? `শ্রমিক: ${filteredWorker.name}` : 'উৎপাদন এন্ট্রি'}
            </CardTitle>
            <CardDescription className="mt-1">
              {filteredWorker 
                ? `${filteredWorker.name}-এর সকল কাজের হিসাব দেখুন।`
                : 'সকল কর্মীর কাজের হিসাব দেখুন এবং নতুন এন্ট্রি যোগ করুন।'}
            </CardDescription>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="w-full md:w-auto" size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            এন্ট্রি যোগ করুন
          </Button>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          <div className="rounded-md border w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  {!workerIdFromQuery && <TableHead>কর্মী</TableHead>}
                  <TableHead>তারিখ</TableHead>
                  <TableHead>ক্যাটাগরি</TableHead>
                  <TableHead className="text-center">পিস</TableHead>
                  <TableHead className="text-center">দর</TableHead>
                  <TableHead className="text-right">মোট টাকা</TableHead>
                  <TableHead className="text-right">কার্যকলাপ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                       {!workerIdFromQuery && <TableCell><Skeleton className="h-5 w-24" /></TableCell>}
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                )}
                {!isLoading && productionEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      কোনো উৎপাদন এন্ট্রি পাওয়া যায়নি।
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && productionEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      {!workerIdFromQuery && <TableCell className="font-medium">{entry.workerName}</TableCell>}
                      <TableCell>{new Date(entry.date).toLocaleDateString('bn-BD')}</TableCell>
                      <TableCell>
                          <Badge variant="outline">{entry.categoryName}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{entry.pieceCount}</TableCell>
                      <TableCell className="text-center">{formatCurrency(entry.rate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.total)}</TableCell>
                      <TableCell className="text-right">
                          <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                          </Button>
                      </TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
