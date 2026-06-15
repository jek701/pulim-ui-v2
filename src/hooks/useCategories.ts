import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { qk } from '../api/queryClient';
import type { Category, Subcategory } from '../types';

export type NewCategory = Omit<Category, 'id' | 'userId' | 'createdAt'>;
export type NewSubcategory = Omit<Subcategory, 'id' | 'userId' | 'createdAt'>;

export function useCategories(userId: string | null) {
  const uid = userId ?? '';
  const qc = useQueryClient();

  const catsQ = useQuery({
    queryKey: qk.categories(uid),
    queryFn: () => api.get<Category[]>('/v1/categories'),
    enabled: !!userId,
  });
  const subsQ = useQuery({
    queryKey: qk.subcategories(uid),
    queryFn: () => api.get<Subcategory[]>('/v1/subcategories'),
    enabled: !!userId,
  });

  const addCategory = async (data: NewCategory) => {
    await api.post('/v1/categories', data);
    qc.invalidateQueries({ queryKey: qk.categories(uid) });
  };
  const removeCategory = async (id: string) => {
    await api.del(`/v1/categories/${id}`);
    qc.invalidateQueries({ queryKey: qk.categories(uid) });
  };
  const addSubcategory = async (data: NewSubcategory) => {
    await api.post('/v1/subcategories', data);
    qc.invalidateQueries({ queryKey: qk.subcategories(uid) });
  };
  const removeSubcategory = async (id: string) => {
    await api.del(`/v1/subcategories/${id}`);
    qc.invalidateQueries({ queryKey: qk.subcategories(uid) });
  };

  return {
    categories: catsQ.data ?? [],
    subcategories: subsQ.data ?? [],
    loading: catsQ.isLoading,
    addCategory,
    removeCategory,
    addSubcategory,
    removeSubcategory,
  };
}
