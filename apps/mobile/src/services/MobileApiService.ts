import { IApiService, ApiResponse } from '@trendguesser/shared';

// API Service implementation for React Native
export class MobileApiService implements IApiService {
  private baseUrl: string;
  
  constructor(baseUrl: string = 'https://trendguesser.com') {
    this.baseUrl = baseUrl;
  }
  
  async get<T>(url: string): Promise<ApiResponse<T>> {
    try {
      // Normalize URL to handle both absolute and relative paths
      const fullUrl = this.normalizeUrl(url);
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      return {
        success: response.ok,
        data: response.ok ? data : undefined,
        error: response.ok ? undefined : data.error || 'Failed to fetch data'
      };
    } catch (error) {
      console.error('API GET error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async post<T>(url: string, data: any): Promise<ApiResponse<T>> {
    try {
      const fullUrl = this.normalizeUrl(url);
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      const responseData = await response.json();
      
      return {
        success: response.ok,
        data: response.ok ? responseData : undefined,
        error: response.ok ? undefined : responseData.error || 'Failed to post data'
      };
    } catch (error) {
      console.error('API POST error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async patch<T>(url: string, data: any): Promise<ApiResponse<T>> {
    try {
      const fullUrl = this.normalizeUrl(url);
      
      const response = await fetch(fullUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      const responseData = await response.json();
      
      return {
        success: response.ok,
        data: response.ok ? responseData : undefined,
        error: response.ok ? undefined : responseData.error || 'Failed to patch data'
      };
    } catch (error) {
      console.error('API PATCH error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  private normalizeUrl(url: string): string {
    if (url.startsWith('http')) {
      return url;
    }
    
    // Handle leading slash
    const relativePath = url.startsWith('/') ? url.substring(1) : url;
    return `${this.baseUrl}/${relativePath}`;
  }
}