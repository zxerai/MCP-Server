import { AsyncLocalStorage } from 'node:async_hooks';
import { IUser } from '../types/index.js';

// Shared async local storage for user context
export const asyncLocalStorage = new AsyncLocalStorage<IUser>();

export class UserContextService {
  private static instance: UserContextService;

  static getInstance(): UserContextService {
    if (!UserContextService.instance) {
      UserContextService.instance = new UserContextService();
    }
    return UserContextService.instance;
  }

  getCurrentUser(): IUser | null {
    return asyncLocalStorage.getStore() ?? null;
  }

  setCurrentUser(user: IUser): void {
    asyncLocalStorage.enterWith(user);
  }

  clearCurrentUser(): void {
    // AsyncLocalStorage automatically clears context when the async operation completes
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.isAdmin || false;
  }

  hasUser(): boolean {
    return this.getCurrentUser() !== null;
  }
}
