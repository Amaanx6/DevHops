'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
  Activity, AlertTriangle, CheckCircle, TrendingUp, TrendingDown,
  Zap, GitBranch, Clock, Shield, Cpu, HardDrive, Wifi,
  Server, BarChart3, RefreshCw, ChevronRight, Filter,
  Download, Settings, Bell, Search, Users, Calendar,
  ArrowUpRight, ArrowDownRight, Eye, ExternalLink,
  Database, GitPullRequest, AlertCircle, LineChart,
  Package, Layers, Target, Brain, Loader2, WifiOff,
  DatabaseIcon, AlertOctagon, GitCommit, BarChart
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

// Types
interface Service {
  id: string;
  name: string;
  metricsUrl: string;
  repoUrl: string;
  registeredAt: string;
  lastChecked: string;
  health: 'healthy' | 'degrading' | 'critical';
  healthScore: number;
  uptime: number;
  currentMetrics?: {
    cpu: number;
    memory: number;
    latency: number;
    errorRate: number;
    throughput: number;
    timestamp: string;
  };
  history?: RawMetricPoint[];
}

interface RawMetricPoint {
  id: string;
  serviceId: string;
  cpu: number;
  memory: number;
  latency: number;
  errorRate: number;
  timestamp: string;
}

interface Anomaly {
  id: string;
  serviceId: string;
  type: 'latency_spike' | 'error_rate' | 'memory_leak' | 'cpu_saturation' | 'resource_forecast';
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: string;
  resolved: boolean;
  confidence: number;
  description: string;
  commitHash?: string;
  deploymentTime?: string;
  estimatedCost?: number; // USD per hour
  resourceImpact?: string; // e.g., "2.5 CPU cores", "4GB RAM"
  potentialDowntime?: number; // minutes
}

interface Deployment {
  id: string;
  serviceId: string;
  commitHash: string;
  author: string;
  time: string;
  riskScore: number;
  summary: string;
}

interface RiskAssessment {
  serviceId: string;
  currentRisk: number;
  trend: 'improving' | 'stable' | 'worsening';
  factors: string[];
  recommendations: string[];
}

export default function Dashboard() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);
  const selectedServiceRef = useRef<Service | null>(null);

  // Sync ref with state
  useEffect(() => {
    selectedServiceRef.current = selectedService;
  }, [selectedService]);

  // Real-time updates state
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Mock data for fallback
  const mockServices: Service[] = [
    {
      id: '1',
      name: 'payments',
      metricsUrl: 'http://localhost:4001/metrics',
      repoUrl: 'https://github.com/devhops/payments',
      registeredAt: '2024-01-15T10:30:00Z',
      lastChecked: new Date().toISOString(),
      health: 'healthy',
      healthScore: 92,
      uptime: 99.98,
      currentMetrics: {
        cpu: 42,
        memory: 68,
        latency: 125,
        errorRate: 0.2,
        throughput: 1250,
        timestamp: new Date().toISOString()
      }
    },
    {
      id: '2',
      name: 'auth-service',
      metricsUrl: 'http://localhost:4002/metrics',
      repoUrl: 'https://github.com/devhops/auth',
      registeredAt: '2024-01-10T14:20:00Z',
      lastChecked: new Date().toISOString(),
      health: 'degrading',
      healthScore: 67,
      uptime: 99.85,
      currentMetrics: {
        cpu: 78,
        memory: 85,
        latency: 320,
        errorRate: 4.2,
        throughput: 890,
        timestamp: new Date().toISOString()
      }
    },
    {
      id: '3',
      name: 'user-api',
      metricsUrl: 'http://localhost:4003/metrics',
      repoUrl: 'https://github.com/devhops/user-api',
      registeredAt: '2024-01-05T09:15:00Z',
      lastChecked: new Date().toISOString(),
      health: 'critical',
      healthScore: 24,
      uptime: 98.72,
      currentMetrics: {
        cpu: 92,
        memory: 95,
        latency: 1250,
        errorRate: 12.5,
        throughput: 420,
        timestamp: new Date().toISOString()
      }
    }
  ];

  const mockAnomalies: Anomaly[] = [
    {
      id: 'a1',
      serviceId: '3',
      type: 'latency_spike',
      severity: 'critical',
      detectedAt: new Date(Date.now() - 3600000).toISOString(),
      resolved: false,
      confidence: 92,
      description: 'Response time increased by 300% after v2.1.0 deployment',
      commitHash: 'a1b2c3d4',
      deploymentTime: new Date(Date.now() - 7200000).toISOString()
    }
  ];

  // Check backend connectivity
  const checkBackend = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:5000/', {
        timeout: 3000
      });
      return response.status === 200;
    } catch (error) {
      try {
        const response = await axios.get('http://127.0.0.1:5000/', {
          timeout: 3000
        });
        return response.status === 200;
      } catch (e) {
        console.log('Backend not available');
        return false;
      }
    }
  }, []);

  // Fetch real metrics from backend (adapted to your API format)
  const fetchRealMetrics = useCallback(async (serviceName: string) => {
    try {
      let response;
      try {
        response = await axios.get(`http://localhost:5000/api/metrics/${serviceName}`, {
          timeout: 5000
        });
      } catch (e) {
        // Fallback to 127.0.0.1
        response = await axios.get(`http://127.0.0.1:5000/api/metrics/${serviceName}`, {
          timeout: 5000
        });
      }

      const rawPoints: RawMetricPoint[] = response.data;

      if (!Array.isArray(rawPoints) || rawPoints.length === 0) {
        return null;
      }

      // Calculate metrics from raw data
      const latest = rawPoints[rawPoints.length - 1];
      const avgCpu = rawPoints.reduce((sum, p) => sum + p.cpu, 0) / rawPoints.length;
      const avgMemory = rawPoints.reduce((sum, p) => sum + p.memory, 0) / rawPoints.length;
      const avgLatency = rawPoints.reduce((sum, p) => sum + p.latency, 0) / rawPoints.length;
      const avgErrorRate = rawPoints.reduce((sum, p) => sum + p.errorRate, 0) / rawPoints.length;

      // Calculate health score
      const cpuScore = Math.max(0, 100 - avgCpu);
      const memoryScore = Math.max(0, 100 - avgMemory);
      const latencyScore = Math.max(0, 100 - (avgLatency / 10));
      const errorScore = Math.max(0, 100 - (avgErrorRate * 10));

      const healthScore = Math.round(
        (cpuScore * 0.25 + memoryScore * 0.25 + latencyScore * 0.3 + errorScore * 0.2)
      );

      const status: 'healthy' | 'degrading' | 'critical' =
        healthScore >= 80 ? 'healthy' :
          healthScore >= 60 ? 'degrading' : 'critical';

      const throughput = latest.cpu / 100 * 2000;

      // Update or create service with real metrics
      setServices(prev => {
        const existingService = prev.find(s => s.name === serviceName);

        if (existingService) {
          return prev.map(service =>
            service.name === serviceName
              ? {
                ...service,
                currentMetrics: {
                  cpu: latest.cpu,
                  memory: latest.memory,
                  latency: latest.latency,
                  errorRate: latest.errorRate,
                  throughput: throughput,
                  timestamp: latest.timestamp
                },
                history: rawPoints,
                health: status,
                healthScore: healthScore,
                uptime: 100 - (avgErrorRate * 10),
                lastChecked: new Date().toISOString()
              }
              : service
          );
        } else {
          const newService: Service = {
            id: Date.now().toString(),
            name: serviceName,
            metricsUrl: `http://localhost:5000/api/metrics/${serviceName}`,
            repoUrl: `https://github.com/devhops/${serviceName}`,
            registeredAt: new Date().toISOString(),
            lastChecked: new Date().toISOString(),
            health: status,
            healthScore: healthScore,
            uptime: 100 - (avgErrorRate * 10),
            currentMetrics: {
              cpu: latest.cpu,
              memory: latest.memory,
              latency: latest.latency,
              errorRate: latest.errorRate,
              throughput: throughput,
              timestamp: latest.timestamp
            },
            history: rawPoints
          };
          return [...prev, newService];
        }
      });

      return {
        current: {
          cpu: latest.cpu,
          memory: latest.memory,
          latency: latest.latency,
          errorRate: latest.errorRate,
          throughput: throughput
        },
        summary: {
          avgCpu,
          avgMemory,
          avgLatency,
          avgErrorRate,
          healthScore,
          status
        }
      };
    } catch (error) {
      console.error(`Failed to fetch metrics for ${serviceName}:`, error);
      return null;
    }
  }, []);

  const fetchAnomalies = useCallback(async (serviceName: string, serviceId: string) => {
    try {
      let response;
      try {
        response = await axios.get(`http://localhost:5000/api/anomalies/${serviceName}`, { timeout: 3000 });
      } catch (e) {
        response = await axios.get(`http://127.0.0.1:5000/api/anomalies/${serviceName}`, { timeout: 3000 });
      }

      const rawAnomalies = response.data;
      if (!Array.isArray(rawAnomalies)) return [];

      return rawAnomalies.map((a: any) => {
        let type = 'unknown';
        if (a.metric === 'resource_forecast') {
          type = 'resource_forecast';
        } else if (a.metric === 'cpu') {
          type = 'cpu_saturation';
        } else if (a.metric === 'memory') {
          type = 'memory_leak';
        } else if (a.metric === 'latency') {
          type = 'latency_spike';
        } else if (a.metric === 'errorRate') {
          type = 'error_rate';
        }

        let severity = 'medium';
        if (type === 'resource_forecast') {
          // For forecasts, severity based on time remaining (stored in value)
          const minsRemaining = a.value;
          if (minsRemaining < 5) severity = 'critical';
          else if (minsRemaining < 15) severity = 'high';
          else severity = 'medium';
        } else {
          if (a.zScore > 3) severity = 'critical';
          else if (a.zScore > 2) severity = 'high';
        }

        // Use custom description if available, otherwise generate default
        let description = `${a.metric} val: ${a.value.toFixed(2)} (baseline: ${a.baseline.toFixed(2)})`;
        if (type === 'resource_forecast') {
          // Backend should provide description like "CPU projected to hit 100% in ~12 mins"
          // But fallback if not present
          description = `Resource exhaustion predicted in ~${Math.round(a.value)} minutes`;
        }

        // Calculate cost and resource impact estimates
        let estimatedCost = 0;
        let resourceImpact = '';
        let potentialDowntime = 0;

        if (type === 'resource_forecast') {
          const minsRemaining = a.value;
          // Cost of emergency scaling or potential outage
          // Assume $50/hour for emergency response + potential revenue loss
          estimatedCost = minsRemaining < 15 ? 150 : 50;
          resourceImpact = a.baseline > 50 ? '4+ CPU cores or 8GB RAM' : '2 CPU cores or 4GB RAM';
          potentialDowntime = minsRemaining < 5 ? 30 : 0; // Potential outage if not addressed
        } else if (type === 'cpu_saturation') {
          // Wasted compute resources
          const excessUsage = Math.max(0, a.value - a.baseline);
          estimatedCost = (excessUsage / 100) * 25; // $25/hour per 100% CPU
          resourceImpact = `${(excessUsage / 25).toFixed(1)} CPU cores`;
          potentialDowntime = severity === 'critical' ? 15 : 0;
        } else if (type === 'memory_leak') {
          const excessMem = Math.max(0, a.value - a.baseline);
          estimatedCost = (excessMem / 100) * 15; // $15/hour per 100% memory
          resourceImpact = `${((excessMem / 100) * 8).toFixed(1)}GB RAM`;
          potentialDowntime = severity === 'critical' ? 20 : 0;
        } else if (type === 'latency_spike') {
          // User experience degradation cost
          const latencyIncrease = a.value - a.baseline;
          estimatedCost = latencyIncrease > 500 ? 200 : 75; // High latency = lost customers
          resourceImpact = `${Math.round(latencyIncrease)}ms added latency`;
          potentialDowntime = 0;
        } else if (type === 'error_rate') {
          // Failed requests = lost revenue
          const errorPercent = a.value;
          estimatedCost = errorPercent * 50; // $50 per 1% error rate per hour
          resourceImpact = `${errorPercent.toFixed(2)}% failed requests`;
          potentialDowntime = severity === 'critical' ? 10 : 0;
        }

        return {
          id: a.id,
          serviceId: serviceId,
          type,
          severity,
          detectedAt: a.timestamp,
          resolved: false,
          confidence: a.confidence ? a.confidence * 100 : 85,
          description,
          commitHash: a.correlatedCommit,
          estimatedCost: Math.round(estimatedCost),
          resourceImpact,
          potentialDowntime
        } as Anomaly;
      });
    } catch (error) {
      console.error(`Failed to fetch anomalies for ${serviceName}:`, error);
      return [];
    }
  }, []);

  // Fetch all real data
  const fetchAllRealData = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setIsLoading(true);
      }

      let isConnected = false;
      let registeredServices: any[] = [];

      // Try fetching services directly to determine connectivity
      try {
        const servicesResponse = await axios.get('http://localhost:5000/api/services');
        registeredServices = servicesResponse.data;
        isConnected = true;
      } catch (error) {
        try {
          // Fallback to 127.0.0.1
          const servicesResponse = await axios.get('http://127.0.0.1:5000/api/services');
          registeredServices = servicesResponse.data;
          isConnected = true;
        } catch (e) {
          console.error('Error fetching services:', e);
        }
      }

      setBackendConnected(isConnected);

      if (!isConnected) {
        console.log('Backend not connected, using mock data');
        setServices(mockServices);
        setAnomalies(mockAnomalies);
        if (!selectedService) {
          setSelectedService(mockServices[0]);
        }
        setLastUpdate(new Date().toISOString());
        return;
      }

      // Backend is connected
      if (registeredServices.length > 0) {
        let allAnomalies: Anomaly[] = [];

        // Fetch metrics and anomalies for each registered service
        for (const svc of registeredServices) {
          await fetchRealMetrics(svc.name);
          const svcAnomalies = await fetchAnomalies(svc.name, svc.id);
          allAnomalies = [...allAnomalies, ...svcAnomalies];
        }

        // Sort anomalies by date desc
        allAnomalies.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
        setAnomalies(allAnomalies);

        // Auto-select first service if none selected (using Ref to avoid stale closure issues)
        if (!selectedServiceRef.current && registeredServices.length > 0) {
          const firstSvc = registeredServices[0];
          const bootstrapService: Service = {
            id: firstSvc.id || 'temp',
            name: firstSvc.name,
            metricsUrl: firstSvc.metricsUrl,
            repoUrl: firstSvc.repoUrl,
            health: 'healthy',
            healthScore: 100,
            uptime: 100,
            registeredAt: new Date().toISOString(),
            lastChecked: new Date().toISOString(),
            currentMetrics: undefined,
            history: []
          };
          setSelectedService(bootstrapService);
        }
      } else {
        console.log("No services registered in backend");
      }







      setLastUpdate(new Date().toISOString());

    } catch (error) {
      console.error('Failed to fetch real data:', error);
      setBackendConnected(false);
      setServices(mockServices);
      setAnomalies(mockAnomalies);
      setSelectedService(mockServices[0]);
    } finally {
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  }, [fetchRealMetrics, fetchAnomalies]);

  // Load service from localStorage
  useEffect(() => {
    const savedService = localStorage.getItem('currentService');
    if (savedService) {
      try {
        const parsedService = JSON.parse(savedService);
        const serviceName = parsedService.name || 'payments';

        // Check if service already exists
        const existingService = services.find(s => s.name === serviceName);

        if (!existingService) {
          const newService: Service = {
            id: parsedService.id || Date.now().toString(),
            name: serviceName,
            metricsUrl: parsedService.metricsUrl || `http://localhost:5000/api/metrics/${serviceName}`,
            repoUrl: parsedService.repoUrl || `https://github.com/devhops/${serviceName}`,
            registeredAt: parsedService.registeredAt || new Date().toISOString(),
            lastChecked: new Date().toISOString(),
            health: 'healthy',
            healthScore: 95,
            uptime: 100,
            currentMetrics: {
              cpu: 35,
              memory: 45,
              latency: 85,
              errorRate: 0.1,
              throughput: 1500,
              timestamp: new Date().toISOString()
            }
          };

          setServices(prev => [...prev, newService]);
          setSelectedService(newService);

          if (backendConnected) {
            fetchRealMetrics(serviceName);
          }
        }
      } catch (error) {
        console.error('Error loading service:', error);
      }
    }
  }, []);

  // Initialize dashboard
  useEffect(() => {
    const initDashboard = async () => {
      await fetchAllRealData();

      const interval = setInterval(async () => {
        const currentService = selectedServiceRef.current;
        // Only fetch metrics for selected service if we are connected
        // But we rely on fetchAllRealData to update connection status
        // So we just try. fetchRealMetrics handles its own errors anyway.
        if (currentService) {
          await fetchRealMetrics(currentService.name);
        }
        await fetchAllRealData(true);
      }, 2000);

      return () => clearInterval(interval);
    };

    initDashboard();
  }, []); // Run once on mount

  // Handle service selection
  const handleServiceSelect = async (service: Service) => {
    setSelectedService(service);

    if (backendConnected) {
      await fetchRealMetrics(service.name);
    }
  };

  // Sync selectedService with services updates
  useEffect(() => {
    if (selectedService) {
      const updatedService = services.find(s => s.id === selectedService.id);
      // Only update if the object reference has changed and it's actually different
      // (checking timestamp or history length might be safer but ref check usually works with immutable updates)
      if (updatedService && updatedService !== selectedService) {
        setSelectedService(updatedService);
      }
    }
  }, [services]);

  // Helper functions
  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-500 bg-green-500/10';
      case 'degrading': return 'text-yellow-500 bg-yellow-500/10';
      case 'critical': return 'text-red-500 bg-red-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />;
      case 'degrading': return <AlertTriangle className="w-4 h-4" />;
      case 'critical': return <AlertOctagon className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-blue-500 bg-blue-500/10';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10';
      case 'high': return 'text-orange-500 bg-orange-500/10';
      case 'critical': return 'text-red-500 bg-red-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-500';
    if (score >= 60) return 'text-orange-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-green-500';
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllRealData();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const calculateOverallHealth = () => {
    if (services.length === 0) return 100;
    const avgScore = services.reduce((sum, service) => sum + service.healthScore, 0) / services.length;
    return Math.round(avgScore);
  };

  const calculateOverallUptime = () => {
    if (services.length === 0) return '100.00';
    const avgUptime = services.reduce((sum, service) => sum + service.uptime, 0) / services.length;
    return avgUptime.toFixed(2);
  };

  const getActiveAnomalies = () => {
    return anomalies.filter(a => !a.resolved).length;
  };

  // Render metric value with indicator
  const renderMetricValue = (value: number | undefined, type: 'cpu' | 'memory' | 'latency' | 'errorRate' | 'throughput') => {
    const safeValue = value || 0;
    const thresholds: Record<string, { good: number; warning: number }> = {
      cpu: { good: 70, warning: 85 },
      memory: { good: 75, warning: 90 },
      latency: { good: 200, warning: 500 },
      errorRate: { good: 1, warning: 5 },
      throughput: { good: 500, warning: 300 }
    };

    const { good, warning } = thresholds[type];
    const isGood = safeValue <= good;
    const isWarning = safeValue > good && safeValue <= warning;

    return (
      <span className={isGood ? 'text-green-500' : isWarning ? 'text-yellow-500' : 'text-red-500'}>
        {type === 'errorRate' ? `${safeValue.toFixed(2)}%` :
          type === 'latency' ? `${safeValue.toFixed(0)}ms` :
            type === 'throughput' ? `${safeValue.toFixed(0)}/s` : `${safeValue.toFixed(1)}%`}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Connection Status Banner */}
      {!backendConnected && !isLoading && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20">
          <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-yellow-500">
              Backend not connected. Showing simulated telemetry data.
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                <Zap className="w-5 h-5 text-black" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">DEVHOPS</h1>
                  {backendConnected && (
                    <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                      Live
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  {backendConnected ? 'Real-time Production Intelligence' : 'Demo Dashboard'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Clock className="w-4 h-4" />
                {lastUpdate ? `Updated: ${new Date(lastUpdate).toLocaleTimeString()}` : 'Loading...'}
              </div>

              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 hover:bg-gray-900 transition-colors ${isRefreshing ? 'opacity-50' : ''}`}
              >
                {isRefreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Refresh
              </button>

              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 text-black font-medium text-sm hover:opacity-90 transition-opacity"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">
              {backendConnected ? 'Connecting to real-time telemetry...' : 'Loading dashboard...'}
            </p>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Platform Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">
                  {backendConnected ? '✨ Live Telemetry Intelligence' : '✨ Telemetry Intelligence Dashboard'}
                </h2>
                <p className="text-gray-400 mt-1">
                  {backendConnected
                    ? `Connected to ${selectedService?.name || 'service'} metrics endpoint`
                    : 'Simulated telemetry data with anomaly detection'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={timeRange}
                  onChange={(e) => {
                    setTimeRange(e.target.value);
                    if (selectedService && backendConnected) {
                      fetchRealMetrics(selectedService.name);
                    }
                  }}
                  className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-yellow-500"
                >
                  <option value="1h">Last hour</option>
                  <option value="6h">Last 6 hours</option>
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                </select>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Server className="w-6 h-6 text-blue-500" />
                  </div>
                  <span className="text-sm font-medium text-green-500">
                    {services.length} services
                  </span>
                </div>
                <div className="text-2xl font-bold">{services.length} Services</div>
                <div className="text-sm text-gray-400">
                  {selectedService ? `Monitoring: ${selectedService.name}` : 'No service selected'}
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  </div>
                  <span className={`text-sm font-medium ${calculateOverallHealth() >= 80 ? 'text-green-500' : calculateOverallHealth() >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                    {calculateOverallHealth()}/100
                  </span>
                </div>
                <div className="text-2xl font-bold">{calculateOverallHealth()}%</div>
                <div className="text-sm text-gray-400">Overall health score</div>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <AlertTriangle className="w-6 h-6 text-yellow-500" />
                  </div>
                  <span className={`text-sm font-medium ${getActiveAnomalies() > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {getActiveAnomalies()} active
                  </span>
                </div>
                <div className="text-2xl font-bold">{getActiveAnomalies()}</div>
                <div className="text-sm text-gray-400">Active anomalies</div>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Shield className="w-6 h-6 text-purple-500" />
                  </div>
                  <span className="text-sm font-medium text-green-500">
                    {selectedService?.currentMetrics ? selectedService.currentMetrics.throughput.toFixed(0) : '0'}/s
                  </span>
                </div>
                <div className="text-2xl font-bold">
                  {selectedService?.currentMetrics ? selectedService.currentMetrics.throughput.toFixed(0) : '0'}/s
                </div>
                <div className="text-sm text-gray-400">Current throughput</div>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Services & Metrics */}
            <div className="lg:col-span-2 space-y-8">

              {/* Detailed Metrics Chart */}
              {selectedService && selectedService.history && (
                <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold">
                      <span className="text-yellow-500">{selectedService.name}</span> Performance History
                    </h3>
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-gray-400">CPU</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                        <span className="text-gray-400">Memory</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                        <span className="text-gray-400">Latency</span>
                      </div>
                    </div>
                  </div>

                  <div className="h-[250px] w-full mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={selectedService.history}>
                        <defs>
                          <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                          dataKey="timestamp"
                          stroke="#666"
                          tick={{ fill: '#666' }}
                          tickFormatter={(str) => new Date(str).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        />
                        <YAxis stroke="#666" tick={{ fill: '#666' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111', borderColor: '#333' }}
                          itemStyle={{ color: '#ccc' }}
                          labelStyle={{ color: '#666' }}
                          labelFormatter={(label) => new Date(label).toLocaleTimeString()}
                        />
                        <Area
                          type="monotone"
                          dataKey="cpu"
                          stroke="#3b82f6"
                          fillOpacity={1}
                          fill="url(#colorCpu)"
                          name="CPU Usage"
                        />
                        <Area
                          type="monotone"
                          dataKey="memory"
                          stroke="#a855f7"
                          fillOpacity={1}
                          fill="url(#colorMemory)"
                          name="Memory Usage"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Latency & Error Rate Chart */}
                  <div className="h-[200px] w-full border-t border-gray-800 pt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={selectedService.history}>
                        <defs>
                          <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorError" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                          dataKey="timestamp"
                          hide={true}
                        />
                        <YAxis stroke="#666" tick={{ fill: '#666' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111', borderColor: '#333' }}
                          itemStyle={{ color: '#ccc' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="latency"
                          stroke="#f97316"
                          fillOpacity={1}
                          fill="url(#colorLatency)"
                          name="Latency (ms)"
                        />
                        <Area
                          type="monotone"
                          dataKey="errorRate"
                          stroke="#ef4444"
                          fillOpacity={1}
                          fill="url(#colorError)"
                          name="Error Rate (%)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {/* Service Health Cards */}
              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Service Health Dashboard</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">Endpoint:</span>
                    <code className="text-yellow-500 text-xs">
                      {selectedService?.metricsUrl || 'http://localhost:5000/api/metrics/'}
                    </code>
                  </div>
                </div>

                <div className="space-y-4">
                  {services.map((service) => {
                    const currentMetrics = service.currentMetrics || {
                      cpu: 0,
                      memory: 0,
                      latency: 0,
                      errorRate: 0,
                      throughput: 0,
                      timestamp: new Date().toISOString()
                    };

                    return (
                      <div
                        key={service.id}
                        onClick={() => handleServiceSelect(service)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all hover:scale-[1.02] ${selectedService?.id === service.id
                          ? 'border-yellow-500 bg-yellow-500/5'
                          : 'border-gray-800 hover:border-gray-700'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${getHealthColor(service.health)}`}>
                              {getHealthIcon(service.health)}
                            </div>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {service.name}
                                <span className="text-xs px-2 py-1 rounded-full bg-gray-800">
                                  {service.healthScore}/100
                                </span>
                              </div>
                              <div className="text-sm text-gray-400">
                                Uptime: {service.uptime.toFixed(2)}%
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm text-gray-400">Last checked</div>
                              <div className="text-sm">{new Date(service.lastChecked).toLocaleTimeString()}</div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>

                        {/* Current Metrics */}
                        <div className="mt-4 grid grid-cols-5 gap-2 text-sm">
                          <div className="text-center">
                            <div className="text-gray-400">CPU</div>
                            <div className="font-medium">{renderMetricValue(currentMetrics.cpu, 'cpu')}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-400">Memory</div>
                            <div className="font-medium">{renderMetricValue(currentMetrics.memory, 'memory')}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-400">Latency</div>
                            <div className="font-medium">{renderMetricValue(currentMetrics.latency, 'latency')}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-400">Error Rate</div>
                            <div className="font-medium">{renderMetricValue(currentMetrics.errorRate, 'errorRate')}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-400">Throughput</div>
                            <div className="font-medium">{currentMetrics.throughput.toFixed(0)}/s</div>
                          </div>
                        </div>

                        {/* Health Score Bar */}
                        <div className="mt-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Health Score</span>
                            <span>{service.healthScore}/100</span>
                          </div>
                          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${service.healthScore >= 80 ? 'bg-green-500' :
                                service.healthScore >= 60 ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`}
                              style={{ width: `${service.healthScore}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Anomalies */}
              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">🚨 Detected Anomalies</h3>
                  <span className="text-sm text-gray-400">Based on telemetry analysis</span>
                </div>

                <div className="space-y-4">
                  {anomalies.filter(a => !a.resolved).length > 0 ? (
                    anomalies.filter(a => !a.resolved).map((anomaly) => {
                      const service = services.find(s => s.id === anomaly.serviceId);
                      const isForecast = anomaly.type === 'resource_forecast';
                      const borderColor = isForecast ? 'border-orange-500/30' : 'border-red-500/20';
                      const bgColor = isForecast ? 'bg-orange-500/10' : 'bg-red-500/5';

                      return (
                        <div key={anomaly.id} className={`p-4 rounded-lg border ${borderColor} ${bgColor}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              {isForecast && <Clock className="w-4 h-4 text-orange-400" />}
                              <div className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(anomaly.severity)}`}>
                                {anomaly.severity.toUpperCase()}
                              </div>
                              <div className="text-sm text-gray-400">
                                {service?.name || 'Unknown'} • {isForecast ? '⏱️ Forecast' : anomaly.type.replace('_', ' ')}
                              </div>
                            </div>
                            <div className="text-sm text-gray-400">
                              {new Date(anomaly.detectedAt).toLocaleTimeString()}
                            </div>
                          </div>

                          <p className="text-sm mb-3">{anomaly.description}</p>

                          {/* Cost and Impact Estimates */}
                          {(anomaly.estimatedCost || anomaly.resourceImpact || anomaly.potentialDowntime) && (
                            <div className="mb-3 p-3 rounded-lg bg-black/30 border border-gray-700/50">
                              <div className="grid grid-cols-3 gap-3 text-xs">
                                {anomaly.estimatedCost && anomaly.estimatedCost > 0 && (
                                  <div className="flex flex-col">
                                    <span className="text-gray-500 mb-1">Est. Cost Impact</span>
                                    <span className="text-red-400 font-semibold text-sm">
                                      ${anomaly.estimatedCost}/hr
                                    </span>
                                  </div>
                                )}
                                {anomaly.resourceImpact && (
                                  <div className="flex flex-col">
                                    <span className="text-gray-500 mb-1">Resource Impact</span>
                                    <span className="text-yellow-400 font-semibold text-sm">
                                      {anomaly.resourceImpact}
                                    </span>
                                  </div>
                                )}
                                {anomaly.potentialDowntime && anomaly.potentialDowntime > 0 && (
                                  <div className="flex flex-col">
                                    <span className="text-gray-500 mb-1">Risk: Downtime</span>
                                    <span className="text-orange-400 font-semibold text-sm">
                                      ~{anomaly.potentialDowntime} mins
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-sm">
                              {anomaly.commitHash && (
                                <div className="flex items-center gap-1">
                                  <GitCommit className="w-4 h-4" />
                                  <code className="text-yellow-400">{anomaly.commitHash.substring(0, 8)}</code>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Target className="w-4 h-4" />
                                <span>{anomaly.confidence}% confidence</span>
                              </div>
                            </div>

                            <button className="text-sm text-yellow-500 hover:text-yellow-400 flex items-center gap-1">
                              Investigate <ArrowUpRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center border border-green-500/20 rounded-lg bg-green-500/5">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <p className="text-gray-300">No active anomalies detected</p>
                      <p className="text-sm text-gray-400 mt-1">All services operating within normal parameters</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Insights & Risk */}
            <div className="space-y-8">
              {/* System Overview */}
              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-6">🧱 TELEMETRY PIPELINE</h3>

                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gray-900/50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <DatabaseIcon className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <div className="font-medium">Metrics Endpoint</div>
                        <div className="text-sm text-gray-400">Real-time data source</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-300">
                      <code className="block p-2 bg-black rounded text-xs mb-2">
                        GET {selectedService?.metricsUrl || 'http://localhost:5000/api/metrics/:service'}
                      </code>
                      <p>Returns: CPU, Memory, Latency, Error Rate</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-gray-900/50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-purple-500/10">
                        <Brain className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <div className="font-medium">Intelligence Engine</div>
                        <div className="text-sm text-gray-400">Analyzes patterns & detects issues</div>
                      </div>
                    </div>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Baseline learning & anomaly detection
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Health score calculation
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Risk assessment & predictions
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Risk Assessment */}
              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">📊 Risk Assessment</h3>
                  <Shield className="w-5 h-5 text-yellow-500" />
                </div>

                <div className="space-y-4">
                  {selectedService && (
                    <div className="p-4 rounded-lg border border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-medium">{selectedService.name}</div>
                        <div className={`text-lg font-bold ${getRiskScoreColor(100 - selectedService.healthScore)}`}>
                          {100 - selectedService.healthScore}
                          <span className="text-sm text-gray-400">/100 risk</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm text-gray-400">Status:</span>
                        <div className={`flex items-center gap-1 ${getHealthColor(selectedService.health)}`}>
                          {getHealthIcon(selectedService.health)}
                          <span className="capitalize">{selectedService.health}</span>
                        </div>
                      </div>

                      {selectedService.currentMetrics && (
                        <div className="space-y-2 mb-3">
                          <div className="text-sm font-medium text-gray-400">Current Metrics:</div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between">
                              <span>CPU:</span>
                              {renderMetricValue(selectedService.currentMetrics.cpu, 'cpu')}
                            </div>
                            <div className="flex justify-between">
                              <span>Memory:</span>
                              {renderMetricValue(selectedService.currentMetrics.memory, 'memory')}
                            </div>
                            <div className="flex justify-between">
                              <span>Latency:</span>
                              {renderMetricValue(selectedService.currentMetrics.latency, 'latency')}
                            </div>
                            <div className="flex justify-between">
                              <span>Error Rate:</span>
                              {renderMetricValue(selectedService.currentMetrics.errorRate, 'errorRate')}
                            </div>
                          </div>
                        </div>
                      )}

                      <button className="mt-3 text-sm text-yellow-500 hover:text-yellow-400 w-full text-left">
                        View detailed metrics →
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Endpoint Status */}
              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-6">🔌 Endpoint Status</h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                      <span className="text-sm">Backend Connection</span>
                    </div>
                    <span className={`text-sm ${backendConnected ? 'text-green-500' : 'text-yellow-500'}`}>
                      {backendConnected ? 'Connected' : 'Using Mock Data'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${services.length > 0 ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <span className="text-sm">Services Monitored</span>
                    </div>
                    <span className="text-sm">{services.length}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getActiveAnomalies() === 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm">Active Anomalies</span>
                    </div>
                    <span className={`text-sm ${getActiveAnomalies() === 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {getActiveAnomalies()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-sm">Data Refresh</span>
                    </div>
                    <span className="text-sm">{backendConnected ? '15s' : 'Manual'}</span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-800">
                  <button
                    onClick={() => {
                      if (backendConnected && selectedService) {
                        window.open(selectedService.metricsUrl, '_blank');
                      } else {
                        window.open('http://localhost:5000/', '_blank');
                      }
                    }}
                    className="w-full py-2 px-4 rounded-lg border border-gray-700 hover:bg-gray-900 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {backendConnected ? 'Open Metrics Endpoint' : 'View API Documentation'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* USP Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-12"
          >
            <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-500/5 border border-yellow-500/20 rounded-xl p-8">
              <h2 className="text-2xl font-bold mb-6 text-center">🔥 REAL-TIME TELEMETRY INTELLIGENCE</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-yellow-500/10">
                      <BarChart className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">✨ Live Metrics Processing</h4>
                      <p className="text-sm text-gray-300">
                        Real-time analysis of CPU, memory, latency, error rates from your service endpoints.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-blue-500/10">
                      <Target className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">✨ Automated Anomaly Detection</h4>
                      <p className="text-sm text-gray-300">
                        Intelligent detection of performance regressions, error spikes, and resource issues.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-green-500/10">
                      <TrendingUp className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">✨ Predictive Health Scoring</h4>
                      <p className="text-sm text-gray-300">
                        Dynamic health scores based on real metrics with trend analysis.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-purple-500/10">
                      <Shield className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">✨ Unified Risk Assessment</h4>
                      <p className="text-sm text-gray-300">
                        Comprehensive risk evaluation with actionable recommendations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {backendConnected && (
                <div className="mt-8 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-green-500 font-medium">
                      Connected to real-time metrics: http://localhost:5000/api/metrics
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}