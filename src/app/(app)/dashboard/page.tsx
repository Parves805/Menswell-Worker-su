
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Scissors, CircleDollarSign, Wallet2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { RecentProductionTable } from '@/components/RecentProductionTable';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import React, { useState } from 'react';
import { ProductionEntry, SliderImage, AdvancePayment, WorkerExpense } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { TakaIcon } from '@/components/icons';
import Autoplay from 'embla-carousel-autoplay';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('bn-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
  }).format(amount);

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [showEarnings, setShowEarnings] = useState(false);

  const allEntriesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'workers', user.uid, 'productionEntries');
  }, [user, firestore]);

  const advancesQuery = useMemoFirebase(
    () => (firestore && user ? collection(firestore, 'workers', user.uid, 'advancePayments') : null),
    [firestore, user]
  );
  
  const expensesQuery = useMemoFirebase(
    () => (firestore && user ? collection(firestore, 'workers', user.uid, 'expenses') : null),
    [firestore, user]
  );

  const sliderImagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sliderImages'), orderBy('createdAt', 'desc'));
  }, [firestore]);
  
  const { data: allEntries, isLoading: isLoadingAllEntries } = useCollection<ProductionEntry>(allEntriesQuery);
  const { data: advances, isLoading: isLoadingAdvances } = useCollection<AdvancePayment>(advancesQuery);
  const { data: expenses, isLoading: isLoadingExpenses } = useCollection<WorkerExpense>(expensesQuery);
  const { data: sliderImages, isLoading: isLoadingSlider } = useCollection<SliderImage>(sliderImagesQuery);

  const totalProduction = React.useMemo(() => {
    if (!allEntries) return 0;
    return allEntries.reduce((sum, entry) => sum + (entry.pieceCount || 0), 0);
  }, [allEntries]);
  
  const totalEarnings = React.useMemo(() => {
    if (!allEntries) return 0;
    return allEntries.reduce((sum, entry) => sum + (entry.total || 0), 0);
  }, [allEntries]);
  
  const totalAdvance = React.useMemo(() => {
    if (!advances) return 0;
    return advances.reduce((sum, advance) => {
        const remaining = (advance.amount || 0) - (advance.paidAmount || 0);
        return sum + (remaining > 0 ? remaining : 0);
    }, 0);
  }, [advances]);

  const totalExpenses = React.useMemo(() => {
    if (!expenses) return 0;
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);
  
  const netEarnings = React.useMemo(() => {
    return totalEarnings - totalExpenses;
  }, [totalEarnings, totalExpenses]);


  const handleToggleEarnings = () => {
    setShowEarnings(true);
    setTimeout(() => {
        setShowEarnings(false);
    }, 3000);
  }

  const isLoading = isLoadingAllEntries || isLoadingExpenses || isLoadingAdvances;

  return (
    <div className="flex flex-col gap-6">
      
      <Card className="w-full bg-primary text-primary-foreground border-none">
        <CardHeader>
          <div className="flex items-center gap-4">
             <Avatar className="h-14 w-14 border-2 border-white/50">
                <AvatarImage src={user?.photoURL ?? "https://picsum.photos/seed/99/100/100"} alt="ব্যবহারকারীর ছবি" />
                <AvatarFallback>{user?.displayName?.charAt(0) ?? 'ক'}</AvatarFallback>
            </Avatar>
            <div>
                <CardTitle>স্বাগতম, {user?.displayName ?? 'কর্মী'}!</CardTitle>
                <CardDescription className="text-primary-foreground/80">
                    আপনার কাজের সারসংক্ষেপ নিচে দেওয়া হলো।
                </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div onClick={handleToggleEarnings} className="cursor-pointer">
              <p className="text-sm">নেট আয়</p>
              {isLoading ? <Skeleton className="h-9 w-36 mt-1 bg-white/20" /> : (
                <p className="text-3xl font-bold">
                    {showEarnings ? formatCurrency(netEarnings) : '৳ ****'}
                </p>
              )}
            </div>
            <Link href="/entry">
              <Button variant="secondary">নতুন এন্ট্রি করুন</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      
       <Carousel
        opts={{
          loop: true,
        }}
        plugins={sliderImages?.map(image => Autoplay({ delay: (image.autoplayDelay || 5) * 1000 })) || []}
        className="w-full"
      >
        <CarouselContent>
          {isLoadingSlider && (
             <CarouselItem>
              <Skeleton className="aspect-[16/7] w-full" />
            </CarouselItem>
          )}
          {!isLoadingSlider && sliderImages?.map((image) => (
            <CarouselItem key={image.id}>
               <Link href={image.link || '#'} target="_blank" rel="noopener noreferrer">
              <Card className="overflow-hidden border-none relative group">
                <CardContent className="p-0">
                  <div className="relative aspect-[16/7] w-full">
                    <Image
                      src={image.imageUrl}
                      alt={image.title || 'Slider image'}
                      fill
                      className="object-cover"
                    />
                     <div className="absolute inset-0 flex flex-col justify-end p-6 bg-gradient-to-t from-black/60 to-transparent">
                     </div>
                  </div>
                </CardContent>
              </Card>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/30 hover:bg-black/50 border-none" />
        <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/30 hover-bg-black/50 border-none" />
      </Carousel>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/all-entries" className="transform transition-transform duration-200 hover:scale-105 group">
          <Card className="transition-colors group-hover:border-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">মোট সেলাই</CardTitle>
              <Scissors className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingAllEntries ? <Skeleton className="h-7 w-20" /> : (
                  <div className="text-2xl font-bold">{totalProduction.toLocaleString('bn-BD')} পিস</div>
              )}
               <p className="text-xs text-muted-foreground">এখন পর্যন্ত মোট কাজ</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/all-entries" className="transform transition-transform duration-200 hover:scale-105 group">
          <Card className="transition-colors group-hover:border-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">মোট আয়</CardTitle>
              <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingAllEntries ? <Skeleton className="h-7 w-28" /> : (
                  <div className="text-2xl font-bold">
                  {formatCurrency(totalEarnings)}
                  </div>
              )}
               <p className="text-xs text-muted-foreground">এখন পর্যন্ত মোট আয়</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/advances" className="transform transition-transform duration-200 hover:scale-105 group">
          <Card className="transition-colors group-hover:border-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">মোট খরচ</CardTitle>
              <Wallet2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
               {isLoadingExpenses ? <Skeleton className="h-7 w-28" /> : (
                  <div className="text-2xl font-bold">
                  {formatCurrency(totalExpenses)}
                  </div>
               )}
              <p className="text-xs text-muted-foreground">অনুমোদিত মোট খরচের পরিমাণ</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/advances" className="transform transition-transform duration-200 hover:scale-105 group">
          <Card className="transition-colors group-hover:border-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">মোট বকেয়া অগ্রিম</CardTitle>
              <TakaIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
               {isLoadingAdvances ? <Skeleton className="h-7 w-28" /> : (
                  <div className="text-2xl font-bold text-destructive">
                  {formatCurrency(totalAdvance)}
                  </div>
               )}
              <p className="text-xs text-muted-foreground">এখন পর্যন্ত মোট গৃহীত অগ্রিম</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <RecentProductionTable />
    </div>
  );
}
