import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance with auth interceptor
const createAuthAxios = () => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return instance;
};

const api = createAuthAxios();

export interface Package {
  package_name: string;
  required_version: string;
  current_version: string | null;
  latest_version: string | null;
  status: 'installed' | 'not_installed' | 'update_available' | 'error';
  repository: string;
}

export interface PackageCheckResponse {
  success: boolean;
  server: {
    id: number;
    hostname: string;
    ip_address: string;
  };
  packages: Package[];
  total_count: number;
}

export interface PackageActionRequest {
  server_id: number;
  packages: string[];
}

export interface PackageActionResponse {
  success: boolean;
  message: string;
  job: {
    id: number;
    job_id: string;
    status: string;
  };
  packages_count: number;
}

export interface UploadCSVResponse {
  success: boolean;
  message: string;
  filename: string;
  packages_count: number;
}

export const patchAPI = {
  /**
   * Upload CSV file with package requirements
   */
  uploadCSV: async (file: File): Promise<UploadCSVResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/patches/upload-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Check packages from uploaded CSV on a server
   */
  checkPackages: async (serverId: number): Promise<PackageCheckResponse> => {
    const response = await api.post(`/patches/check/${serverId}`);
    return response.data;
  },

  /**
   * Install selected packages on a server
   */
  installPackages: async (data: PackageActionRequest): Promise<PackageActionResponse> => {
    const response = await api.post('/patches/install', data);
    return response.data;
  },

  /**
   * Update selected packages on a server
   */
  updatePackages: async (data: PackageActionRequest): Promise<PackageActionResponse> => {
    const response = await api.post('/patches/update', data);
    return response.data;
  },
};
