'use client';

import React, { useMemo, useState } from 'react';
import { Header } from '../components/test/Header';
import { Filters, StatusFilter, SortOption } from '../components/test/Filters';
import { TestsTable } from '../components/test/TestsTable';
import { useQAData } from '../context/QADataContext';
import { useNewTestModal } from '../context/NewTestModalContext';
import { useToast } from '../context/ToastContext';

export const TestManagementPage: React.FC = () => {
  const { tests, loading, deleteTest, rerunTest } = useQAData();
  const { open } = useNewTestModal();
  const { showToast } = useToast();

  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortOption>('newest');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filtered = useMemo(() => {
    let list = [...tests];

    if (status === 'running') list = list.filter((t) => t.status === 'queued' || t.status === 'running');
    else if (status !== 'all') list = list.filter((t) => t.status === status);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.url.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === 'score-desc') return (b.score ?? -1) - (a.score ?? -1);
      if (sort === 'score-asc') return (a.score ?? 999) - (b.score ?? 999);
      return 0;
    });

    return list;
  }, [tests, status, search, sort]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const handleDelete = async (id: string) => {
    try {
      await deleteTest(id);
      showToast('Test deleted', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete test', 'error');
    }
  };

  const handleRerun = async (id: string) => {
    try {
      await rerunTest(id);
      showToast('Test re-queued for scanning', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not re-run test', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in w-full">
      <Header
        onRunNewTest={open}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
      />

      <Filters
        status={status}
        onStatusChange={(s) => {
          setStatus(s);
          setPage(1);
        }}
        sort={sort}
        onSortChange={setSort}
      />

      <TestsTable
        tests={paginated}
        totalCount={filtered.length}
        loading={loading}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        onPageChange={setPage}
        onDelete={handleDelete}
        onRerun={handleRerun}
      />
    </div>
  );
};
