
'use client';

import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
import { MoreHorizontal, PlusCircle, User, Scissors, Eye } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import type { Worker, ProductionEntry as ProductionEntryType } from '@/lib/types';
import { AddProductionEntryDialog } from '@/components/admin/AddProductionEntryDialog';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';


const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('bn-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
  }).format(amount);

interface CategorySummary {
  categoryId: string;
  categoryName: string;
  categoryImageUrl?: string;
  totalPieces: number;
  totalAmount: number;
  entries: ProductionEntryType[];
}


export default function ProductionPage() {
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const workerIdFromQuery = searchParams.get('workerId');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [productionEntries, setProductionEntries] = useState<ProductionEntryType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filteredWorker, setFilteredWorker] = useState<Worker | null>(null);

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


  useEffect(() => {
    fetchProductionEntries();
  }, [fetchProductionEntries]);

  const categorySummaries = useMemo((): CategorySummary[] | null => {
    if (!productionEntries) return null;
  
    const summaryMap = new Map<string, CategorySummary>();
  
    productionEntries.forEach((entry) => {
      let summary = summaryMap.get(entry.categoryId);
      if (!summary) {
        summary = {
          categoryId: entry.categoryId,
          categoryName: entry.categoryName,
          categoryImageUrl: entry.categoryImageUrl || 'https://picsum.photos/seed/placeholder/64/64',
          totalPieces: 0,
          totalAmount: 0,
          entries: [],
        };
      }
      summary.totalPieces += entry.pieceCount;
      summary.totalAmount += entry.total;
      summary.entries.push(entry);
      summaryMap.set(entry.categoryId, summary);
    });
  
    return Array.from(summaryMap.values());
  }, [productionEntries]);


  const handleEntryAdded = () => {
    fetchProductionEntries();
  };

  if (workerIdFromQuery) {
      return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        {filteredWorker?.photo ? (
                            <Image src={filteredWorker.photo} alt={filteredWorker.name} width={40} height={40} className="rounded-full" />
                        ) : <Skeleton className="h-10 w-10 rounded-full" />}
                         <div>
                            <CardTitle className='flex items-center gap-2'>
                                {filteredWorker ? `${filteredWorker.name}-এর উৎপাদন` : 'উৎপাদন এন্ট্রি'}
                            </CardTitle>
                            <CardDescription className="mt-1">
                                {filteredWorker 
                                    ? `${filteredWorker.name}-এর সকল কাজের ক্যাটাগরি-ভিত্তিক হিসাব দেখুন।`
                                    : 'কর্মীর কাজের হিসাব দেখুন।'}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {isLoading && (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-64" />)}
                 </div>
            )}

            {!isLoading && (!categorySummaries || categorySummaries.length === 0) ? (
                <Card>
                    <CardContent className="h-48 flex flex-col items-center justify-center text-center">
                        <Scissors className="w-12 h-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">কোনো কাজের এন্ট্রি পাওয়া যায়নি</h3>
                        <p className="text-muted-foreground text-sm">এই কর্মীর জন্য কোনো উৎপাদন এন্ট্রি যোগ করা হয়নি।</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categorySummaries?.map((summary) => (
                    <Card key={summary.categoryId} className="flex flex-col">
                    <CardHeader className="flex-grow">
                        <div className="flex items-center gap-4">
                        {summary.categoryImageUrl && (
                            <Image 
                            src={summary.categoryImageUrl} 
                            alt={summary.categoryName} 
                            width={64} 
                            height={64} 
                            className="rounded-md object-cover h-16 w-16" 
                            unoptimized
                            onError={(e) => { e.currentTarget.src = 'https://picsum.photos/seed/placeholder/64/64'; }}
                            />
                        )}
                        <div>
                            <CardTitle>{summary.categoryName}</CardTitle>
                            <CardDescription>কাজের সারসংক্ষেপ</CardDescription>
                        </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className='flex justify-between items-center bg-muted p-3 rounded-md'>
                            <span className="text-sm text-muted-foreground">মোট পিস</span>
                            <span className="font-bold text-lg">{summary.totalPieces.toLocaleString('bn-BD')}</span>
                        </div>
                        <div className='flex justify-between items-center bg-muted p-3 rounded-md'>
                            <span className="text-sm text-muted-foreground">মোট আয়</span>
                            <span className="font-bold text-lg text-primary">{formatCurrency(summary.totalAmount)}</span>
                        </div>
                        
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full mt-2">
                                <Eye className="mr-2 h-4 w-4" /> বিস্তারিত দেখুন
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-xl">
                                <DialogHeader>
                                <DialogTitle>{summary.categoryName} - বিস্তারিত এন্ট্রি</DialogTitle>
                                </DialogHeader>
                                <div className="max-h-[60vh] overflow-y-auto mt-4 pr-4">
                                    <Table>
                                        <TableHeader>
                                        <TableRow>
                                            <TableHead>তারিখ</TableHead>
                                            <TableHead className="text-center">পিস</TableHead>
                                            <TableHead className="text-right">মোট টাকা</TableHead>
                                        </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                        {summary.entries.map(entry => (
                                            <TableRow key={entry.id}>
                                            <TableCell>{new Date(entry.date).toLocaleDateString('bn-BD')}</TableCell>
                                            <TableCell className="text-center">{entry.pieceCount.toLocaleString('bn-BD')}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(entry.total)}</TableCell>
                                            </TableRow>
                                        ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </CardContent>
                    </Card>
                ))}
                </div>
            )}
        </div>
      )
  }


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
                  <TableHead>কর্মী</TableHead>
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
                       <TableCell><Skeleton className="h-5 w-24" /></TableCell>
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
                      <TableCell className="font-medium">{entry.workerName}</TableCell>
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
