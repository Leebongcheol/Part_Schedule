import * as React from 'react';
import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ITodo, TodoPriority } from '../../models';
import styles from './TodoList.module.scss';

interface ITodoListProps {
  todos: ITodo[];
  memberId: number;
  onRefresh: () => Promise<void>;
}

export function TodoList({ todos, memberId, onRefresh }: ITodoListProps): React.ReactElement {
  const { service } = useAppContext();
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TodoPriority>('보통');
  const [saving, setSaving] = useState(false);

  const inProgress = todos.filter(t => t.status === '진행중');
  const pending = todos.filter(t => t.status === '대기');
  const completed = todos.filter(t => t.status === '완료');

  const handleAdd = async (): Promise<void> => {
    if (!newTitle.trim()) return;
    setSaving(true);
    await service.addTodo({
      title: newTitle,
      assigneeId: memberId,
      status: '대기',
      priority: newPriority,
    });
    setNewTitle('');
    setShowAdd(false);
    setSaving(false);
    await onRefresh();
  };

  const handleStatusChange = async (todo: ITodo, newStatus: string): Promise<void> => {
    await service.updateTodo(todo.id, { status: newStatus as any });
    await onRefresh();
  };

  const handleDelete = async (id: number): Promise<void> => {
    await service.deleteTodo(id);
    await onRefresh();
  };

  const priorityIcon = (priority: TodoPriority): string => {
    switch (priority) {
      case '높음': return '🔴';
      case '보통': return '🟡';
      case '낮음': return '🟢';
    }
  };

  const renderTodoItem = (todo: ITodo): React.ReactElement => (
    <div key={todo.id} className={styles.todoItem}>
      <span className={styles.priorityIcon}>{priorityIcon(todo.priority)}</span>
      <span className={`${styles.todoTitle} ${todo.status === '완료' ? styles.completed : ''}`}>
        {todo.title}
      </span>
      <select
        className={styles.statusSelect}
        value={todo.status}
        onChange={e => handleStatusChange(todo, e.target.value)}
      >
        <option value="대기">대기</option>
        <option value="진행중">진행중</option>
        <option value="완료">완료</option>
      </select>
      <button className={styles.deleteBtn} onClick={() => handleDelete(todo.id)}>🗑</button>
    </div>
  );

  return (
    <div className={styles.container}>
      {/* 요약 */}
      <div className={styles.summary}>
        <span className={styles.summaryItem}>진행중 {inProgress.length}</span>
        <span className={styles.summaryItem}>대기 {pending.length}</span>
        <span className={styles.summaryItem}>완료 {completed.length}</span>
      </div>

      {/* 진행중 */}
      {inProgress.length > 0 && (
        <div className={styles.group}>
          <h5 className={styles.groupTitle}>진행중</h5>
          {inProgress.map(renderTodoItem)}
        </div>
      )}

      {/* 대기 */}
      {pending.length > 0 && (
        <div className={styles.group}>
          <h5 className={styles.groupTitle}>대기</h5>
          {pending.map(renderTodoItem)}
        </div>
      )}

      {/* 완료 */}
      {completed.length > 0 && (
        <div className={styles.group}>
          <h5 className={styles.groupTitle}>완료</h5>
          {completed.map(renderTodoItem)}
        </div>
      )}

      {/* 추가 폼 */}
      {showAdd ? (
        <div className={styles.addForm}>
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="할 일을 입력하세요"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <select value={newPriority} onChange={e => setNewPriority(e.target.value as TodoPriority)}>
            <option value="높음">높음</option>
            <option value="보통">보통</option>
            <option value="낮음">낮음</option>
          </select>
          <button onClick={handleAdd} disabled={saving}>
            {saving ? '...' : '추가'}
          </button>
          <button onClick={() => setShowAdd(false)}>취소</button>
        </div>
      ) : (
        <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
          + 할 일 추가
        </button>
      )}
    </div>
  );
}
