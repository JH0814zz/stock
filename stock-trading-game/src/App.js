import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const INITIAL_BALANCE = 1000000;
const DISPLAY_SECONDS = 120;
const INITIAL_STOCKS = Array.from({ length: 10 }, (_, i) => ({
  id: `STOCK${i + 1}`,
  price: Math.floor(Math.random() * 4500) + 500,
  buyHistory: [] // 각 구매 기록 저장: [{price: number, amount: number}]
}));

const StockTradingGame = () => {
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [stocks, setStocks] = useState(INITIAL_STOCKS);
  const [portfolio, setPortfolio] = useState({});
  const [priceHistory, setPriceHistory] = useState(
    Object.fromEntries(stocks.map(stock => [stock.id, [{ time: 0, price: stock.price }]]))
  );
  const [selectedStock, setSelectedStock] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradeType, setTradeType] = useState('');
  const timeRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      timeRef.current += 1;
      setStocks(prevStocks => 
        prevStocks.map(stock => ({
          ...stock,
          price: Math.max(100, stock.price + Math.floor(Math.random() * 21) - 10)
        }))
      );

      setPriceHistory(prev => {
        const updated = { ...prev };
        stocks.forEach(stock => {
          updated[stock.id] = [...(updated[stock.id] || []), {
            time: timeRef.current,
            price: stock.price
          }];
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [stocks]);

  const calculateStockStats = (stockId) => {
    const stock = stocks.find(s => s.id === stockId);
    const amount = portfolio[stockId] || 0;
    
    if (amount === 0) return null;

    const purchases = stock.buyHistory;
    const totalCost = purchases.reduce((sum, p) => sum + (p.price * p.amount), 0);
    const totalShares = purchases.reduce((sum, p) => sum + p.amount, 0);
    const avgPrice = totalShares > 0 ? totalCost / totalShares : 0;
    const currentValue = stock.price * amount;
    const profitLoss = currentValue - (avgPrice * amount);
    const profitRate = avgPrice > 0 ? (profitLoss / (avgPrice * amount)) * 100 : 0;

    return {
      currentPrice: stock.price,
      shares: amount,
      avgPrice,
      profitLoss,
      profitRate
    };
  };

  const handleTrade = () => {
    const amount = parseInt(tradeAmount);
    const stock = stocks.find(s => s.id === selectedStock);
    
    if (tradeType === 'buy') {
      const totalCost = stock.price * amount;
      if (totalCost > balance) {
        alert('잔고가 부족합니다!');
        return;
      }
      setBalance(prev => prev - totalCost);
      setPortfolio(prev => ({
        ...prev,
        [selectedStock]: (prev[selectedStock] || 0) + amount
      }));
      // 구매 기록 추가
      setStocks(prev => prev.map(s => 
        s.id === selectedStock 
          ? { ...s, buyHistory: [...s.buyHistory, { price: s.price, amount }] }
          : s
      ));
    } else {
      if (amount > (portfolio[selectedStock] || 0)) {
        alert('보유 주식이 부족합니다!');
        return;
      }
      setBalance(prev => prev + stock.price * amount);
      setPortfolio(prev => {
        const updated = { ...prev };
        updated[selectedStock] -= amount;
        if (updated[selectedStock] <= 0) {
          delete updated[selectedStock];
          // 매도시 구매 기록 초기화
          setStocks(prev => prev.map(s => 
            s.id === selectedStock ? { ...s, buyHistory: [] } : s
          ));
        }
        return updated;
      });
    }
    setIsDialogOpen(false);
    setTradeAmount('');
  };

  const formatPrice = (price) => new Intl.NumberFormat('ko-KR').format(Math.round(price));

  const StockChart = ({ stockId }) => {
    const data = priceHistory[stockId];
    const currentTime = timeRef.current;
    const startTime = Math.max(0, currentTime - DISPLAY_SECONDS);
    
    const visibleData = data.filter(d => 
      d.time >= startTime && d.time <= currentTime
    );

    const stats = calculateStockStats(stockId);
    
    // Y축 범위 계산
    const prices = visibleData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const yAxisMin = Math.max(0, minPrice - priceRange * 0.1);
    const yAxisMax = maxPrice + priceRange * 0.1;

    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>{stockId}</span>
            <div className="text-base font-normal">
              <p>현재가: {formatPrice(stocks.find(s => s.id === stockId).price)}원</p>
              {stats && (
                <div>
                  <p>내 주식: {stats.shares}주 
                    <span className={`ml-2 ${stats.profitLoss >= 0 ? "text-green-500" : "text-red-500"}`}>
                      ({formatPrice(stats.avgPrice)}원)
                    </span>
                  </p>
                  <p className={stats.profitRate >= 0 ? "text-green-500" : "text-red-500"}>
                    손익률: {stats.profitRate.toFixed(2)}%
                  </p>
                  <p className={stats.profitLoss >= 0 ? "text-green-500" : "text-red-500"}>
                    순이익: {formatPrice(stats.profitLoss)}원
                  </p>
                </div>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <LineChart 
              data={visibleData} 
              width={600} 
              height={300}
            >
              <XAxis 
                dataKey="time" 
                domain={[startTime, currentTime]}
                type="number"
                tickFormatter={(value) => `${value}초`}
              />
              <YAxis 
                domain={[yAxisMin, yAxisMax]}
                tickFormatter={(value) => formatPrice(value)}
              />
              <Tooltip 
                formatter={(value) => formatPrice(value) + '원'}
                labelFormatter={(value) => `${value}초`}
              />
              <Legend />
              <Line 
                name="주가"
                type="monotone" 
                dataKey="price" 
                stroke="#8884d8" 
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </LineChart>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="text-2xl font-bold mb-4">
        잔고: {formatPrice(balance)}원
      </div>

      <Tabs defaultValue="buy">
        <TabsList>
          <TabsTrigger value="buy">Buy</TabsTrigger>
          <TabsTrigger value="sell">Sell</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
        </TabsList>

        <TabsContent value="buy">
          <div className="grid grid-cols-2 gap-4">
            {stocks.map(stock => (
              <div key={stock.id} className="flex gap-2">
                <Button
                  className="flex-1 p-4"
                  onClick={() => {
                    setSelectedStock(stock.id);
                    setTradeType('buy');
                    setIsDialogOpen(true);
                  }}
                >
                  {stock.id}: {formatPrice(stock.price)}원
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedStock(stock.id);
                    setIsChartOpen(true);
                  }}
                >
                  차트
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sell">
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(portfolio).map(([stockId, amount]) => {
              const stats = calculateStockStats(stockId);
              return (
                <div key={stockId} className="flex gap-2">
                  <Button
                    className="flex-1 p-4"
                    onClick={() => {
                      setSelectedStock(stockId);
                      setTradeType('sell');
                      setIsDialogOpen(true);
                    }}
                  >
                    <div>
                      <div>{stockId}: {amount}주</div>
                      <div className={stats?.profitLoss >= 0 ? "text-green-500" : "text-red-500"}>
                        {stats?.profitRate.toFixed(2)}%
                      </div>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedStock(stockId);
                      setIsChartOpen(true);
                    }}
                  >
                    차트
                  </Button>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="charts">
          <div className="grid grid-cols-1 gap-4">
            {stocks.map(stock => (
              <StockChart key={stock.id} stockId={stock.id} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tradeType === 'buy' ? '주식 구매' : '주식 판매'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-lg font-bold">
              {selectedStock}: {formatPrice(stocks.find(s => s.id === selectedStock)?.price || 0)}원
            </p>
            <Input
              type="number"
              placeholder="수량을 입력하세요"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
            />
            <Button onClick={handleTrade}>
              {tradeType === 'buy' ? '구매' : '판매'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isChartOpen} onOpenChange={setIsChartOpen}>
        <DialogContent className="max-w-4xl">
          {selectedStock && <StockChart stockId={selectedStock} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockTradingGame;
