/**
 * AuthContext.tsx — Trạng thái đăng nhập toàn cục.
 *
 * Cung cấp:
 *   - user: UserProfile | null
 *   - isLoading: bool (đang kiểm tra token cũ khi tải trang)
 *   - signIn(username, password): Promise<void>
 *   - signOut(): void
 *
 * Không lưu mật khẩu. Không ghi token vào log hoặc console.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  clearToken,
  getMe,
  login,
  saveToken,
  type UserProfile,
} from './api'

interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Khi tải trang: thử dùng lại token cũ trong sessionStorage
  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {
        // Token hết hạn hoặc không có — không phải lỗi cần hiển thị
        clearToken()
      })
      .finally(() => setIsLoading(false))
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    const resp = await login(username, password)
    saveToken(resp.access_token)
    const profile = await getMe()
    setUser(profile)
  }, [])

  const signOut = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
