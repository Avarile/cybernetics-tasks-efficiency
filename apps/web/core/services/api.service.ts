import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:9100"}/api/v1`;

export class APIService {
  protected axiosInstance: AxiosInstance;

  constructor(baseURL: string = BASE_URL) {
    this.axiosInstance = axios.create({
      baseURL,
      withCredentials: true,
    });

    this.axiosInstance.interceptors.request.use((config) => {
      const token = localStorage.getItem("auth_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.axiosInstance.interceptors.response.use(
      (response) => {
        if (response.data && "data" in response.data && "status_code" in response.data) {
          response.data = response.data.data;
        }
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem("auth_token");
          window.location.href = "/auth/sign-in";
        }
        return Promise.reject(error);
      }
    );
  }

  get<T>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig) {
    return this.axiosInstance.get<T>(url, { params, ...config });
  }

  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.axiosInstance.post<T>(url, data, config);
  }

  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.axiosInstance.patch<T>(url, data, config);
  }

  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.axiosInstance.put<T>(url, data, config);
  }

  delete<T>(url: string, config?: AxiosRequestConfig) {
    return this.axiosInstance.delete<T>(url, config);
  }
}
