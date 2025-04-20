import { IApiService, ApiResponse } from '@trendguesser/shared';

export class WebApiService implements IApiService {
  async get<T>(url: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        return {
          success: false,
          error: `Request failed with status: ${response.status}`
        };
      }
      
      const data = await response.json();
      
      return {
        success: true,
        data
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
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        return {
          success: false,
          error: `Request failed with status: ${response.status}`
        };
      }
      
      const responseData = await response.json();
      
      return {
        success: true,
        data: responseData
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
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        return {
          success: false,
          error: `Request failed with status: ${response.status}`
        };
      }
      
      const responseData = await response.json();
      
      return {
        success: true,
        data: responseData
      };
    } catch (error) {
      console.error('API PATCH error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}