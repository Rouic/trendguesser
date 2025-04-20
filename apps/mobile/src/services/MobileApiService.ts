import { IApiService, ApiResponse } from '@trendguesser/shared';
import { Platform } from 'react-native';

export class MobileApiService implements IApiService {
  private baseUrl: string;
  
  constructor(baseUrl: string = 'https://trendguesser.com') {
    this.baseUrl = baseUrl;
  }
  
  async get<T>(url: string): Promise<ApiResponse<T>> {
    try {
      const fullUrl = this.normalizeUrl(url);
      
      // Add timeout and more comprehensive error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout
      
      try {
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: this.getHeaders(),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // More detailed error logging
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`GET Error (${response.status}):`, errorText);
          
          return {
            success: false,
            error: `HTTP error ${response.status}: ${errorText}`
          };
        }
        
        const data = await response.json();
        return {
          success: true,
          data: data
        };
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        
        // More comprehensive error handling
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('Request timed out');
          return {
            success: false,
            error: 'Request timed out'
          };
        }
        
        console.error('Fetch error details:', {
          message: fetchError instanceof Error ? fetchError.message : 'Unknown error',
          name: fetchError instanceof Error ? fetchError.name : 'Unknown',
          stack: fetchError instanceof Error ? fetchError.stack : undefined
        });
        
        return {
          success: false,
          error: this.processNetworkError(fetchError)
        };
      }
    } catch (error: unknown) {
      console.error('Unexpected API GET error:', error);
      return {
        success: false,
        error: this.processNetworkError(error)
      };
    }
  }
  
  async post<T>(url: string, data: any): Promise<ApiResponse<T>> {
    try {
      const fullUrl = this.normalizeUrl(url);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const response = await fetch(fullUrl, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(data),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`POST Error (${response.status}):`, errorText);
          
          return {
            success: false,
            error: `HTTP error ${response.status}: ${errorText}`
          };
        }
        
        const responseData = await response.json();
        return {
          success: true,
          data: responseData
        };
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('Request timed out');
          return {
            success: false,
            error: 'Request timed out'
          };
        }
        
        console.error('Fetch error details:', {
          message: fetchError instanceof Error ? fetchError.message : 'Unknown error',
          name: fetchError instanceof Error ? fetchError.name : 'Unknown',
          stack: fetchError instanceof Error ? fetchError.stack : undefined
        });
        
        return {
          success: false,
          error: this.processNetworkError(fetchError)
        };
      }
    } catch (error: unknown) {
      console.error('Unexpected API POST error:', error);
      return {
        success: false,
        error: this.processNetworkError(error)
      };
    }
  }
  
  async patch<T>(url: string, data: any): Promise<ApiResponse<T>> {
    try {
      const fullUrl = this.normalizeUrl(url);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const response = await fetch(fullUrl, {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify(data),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`PATCH Error (${response.status}):`, errorText);
          
          return {
            success: false,
            error: `HTTP error ${response.status}: ${errorText}`
          };
        }
        
        const responseData = await response.json();
        return {
          success: true,
          data: responseData
        };
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('Request timed out');
          return {
            success: false,
            error: 'Request timed out'
          };
        }
        
        console.error('Fetch error details:', {
          message: fetchError instanceof Error ? fetchError.message : 'Unknown error',
          name: fetchError instanceof Error ? fetchError.name : 'Unknown',
          stack: fetchError instanceof Error ? fetchError.stack : undefined
        });
        
        return {
          success: false,
          error: this.processNetworkError(fetchError)
        };
      }
    } catch (error: unknown) {
      console.error('Unexpected API PATCH error:', error);
      return {
        success: false,
        error: this.processNetworkError(error)
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
  
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      // Add any additional headers like authentication tokens
      // 'Authorization': `Bearer ${this.getAuthToken()}`,
    };
  }
  
  private processNetworkError(error: unknown): string {
    // Centralized error processing
    if (error instanceof Error) {
      if (error.message.includes('Network request failed')) {
        // Common React Native network error
        return this.getDiagnosticNetworkErrorMessage();
      }
      
      return error.message;
    }
    
    return 'Unknown network error';
  }
  
  private getDiagnosticNetworkErrorMessage(): string {
    // Provide more context about potential network issues
    return Platform.select({
      ios: 'iOS network request failed. Check: \n' +
           '- Network connectivity\n' +
           '- Airplane mode\n' +
           '- VPN or proxy settings\n' +
           '- SSL certificate issues',
      android: 'Android network request failed. Check: \n' +
               '- Network connectivity\n' +
               '- Mobile data or WiFi\n' +
               '- Firewall or security settings\n' +
               '- SSL certificate issues',
      default: 'Network request failed. Check network connectivity.'
    });
  }
}