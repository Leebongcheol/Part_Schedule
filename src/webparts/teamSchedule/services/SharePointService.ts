import { spfi, SPFx } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import '@pnp/sp/site-users/web';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import {
  ITeamMember,
  ISchedule,
  IAttendanceStatus,
  ITodo,
  IWorkloadStatus,
  AttendanceStatusType,
  TodoStatus,
  TodoPriority,
  WorkloadStatusType,
} from '../models';

const LIST_NAMES = {
  MEMBERS: 'TeamMembers',
  SCHEDULES: 'Schedules',
  ATTENDANCE: 'AttendanceStatus',
  TODOS: 'Todos',
  WORKLOAD: 'WorkloadStatus',
};

export class SharePointService {
  private sp: ReturnType<typeof spfi>;

  constructor(context: WebPartContext) {
    this.sp = spfi().using(SPFx(context));
  }

  // ─── TeamMembers ───────────────────────────────────────────

  public async getMembers(): Promise<ITeamMember[]> {
    const items = await this.sp.web.lists
      .getByTitle(LIST_NAMES.MEMBERS)
      .items.select('Id', 'Title', 'Color', 'Department', 'Role', 'Email', 'IsActive')
      .filter('IsActive eq 1')
      .orderBy('Title')();

    return items.map((item: any) => ({
      id: item.Id,
      name: item.Title,
      color: item.Color,
      department: item.Department,
      role: item.Role,
      email: item.Email,
      isActive: item.IsActive,
    }));
  }

  public async addMember(member: Omit<ITeamMember, 'id'>): Promise<ITeamMember> {
    const result = await this.sp.web.lists
      .getByTitle(LIST_NAMES.MEMBERS)
      .items.add({
        Title: member.name,
        Color: member.color,
        Department: member.department,
        Role: member.role,
        Email: member.email,
        IsActive: member.isActive,
      });

    return { ...member, id: result.Id };
  }

  public async updateMember(id: number, member: Partial<ITeamMember>): Promise<void> {
    const updateData: any = {};
    if (member.name !== undefined) updateData.Title = member.name;
    if (member.color !== undefined) updateData.Color = member.color;
    if (member.department !== undefined) updateData.Department = member.department;
    if (member.role !== undefined) updateData.Role = member.role;
    if (member.isActive !== undefined) updateData.IsActive = member.isActive;

    await this.sp.web.lists
      .getByTitle(LIST_NAMES.MEMBERS)
      .items.getById(id)
      .update(updateData);
  }

  // ─── Schedules ─────────────────────────────────────────────

  public async getSchedules(startDate: Date, endDate: Date): Promise<ISchedule[]> {
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    const items = await this.sp.web.lists
      .getByTitle(LIST_NAMES.SCHEDULES)
      .items.select(
        'Id', 'Title', 'StartDate', 'EndDate',
        'AssigneeId', 'Assignee/Title',
        'Description', 'Category', 'IsRecurring', 'RecurrenceRule'
      )
      .expand('Assignee')
      .filter(`StartDate le datetime'${endISO}' and EndDate ge datetime'${startISO}'`)
      .orderBy('StartDate')();

    return items.map((item: any) => ({
      id: item.Id,
      title: item.Title,
      startDate: new Date(item.StartDate),
      endDate: new Date(item.EndDate),
      assigneeId: item.AssigneeId,
      assigneeName: item.Assignee?.Title,
      description: item.Description || '',
      category: item.Category,
      isRecurring: item.IsRecurring || false,
      recurrenceRule: item.RecurrenceRule,
    }));
  }

  public async addSchedule(schedule: Omit<ISchedule, 'id' | 'assigneeName'>): Promise<ISchedule> {
    const result = await this.sp.web.lists
      .getByTitle(LIST_NAMES.SCHEDULES)
      .items.add({
        Title: schedule.title,
        StartDate: schedule.startDate.toISOString(),
        EndDate: schedule.endDate.toISOString(),
        AssigneeId: schedule.assigneeId,
        Description: schedule.description,
        Category: schedule.category,
        IsRecurring: schedule.isRecurring,
        RecurrenceRule: schedule.recurrenceRule || '',
      });

    return { ...schedule, id: result.Id };
  }

  public async updateSchedule(id: number, schedule: Partial<ISchedule>): Promise<void> {
    const updateData: any = {};
    if (schedule.title !== undefined) updateData.Title = schedule.title;
    if (schedule.startDate !== undefined) updateData.StartDate = schedule.startDate.toISOString();
    if (schedule.endDate !== undefined) updateData.EndDate = schedule.endDate.toISOString();
    if (schedule.assigneeId !== undefined) updateData.AssigneeId = schedule.assigneeId;
    if (schedule.description !== undefined) updateData.Description = schedule.description;
    if (schedule.category !== undefined) updateData.Category = schedule.category;
    if (schedule.isRecurring !== undefined) updateData.IsRecurring = schedule.isRecurring;
    if (schedule.recurrenceRule !== undefined) updateData.RecurrenceRule = schedule.recurrenceRule;

    await this.sp.web.lists
      .getByTitle(LIST_NAMES.SCHEDULES)
      .items.getById(id)
      .update(updateData);
  }

  public async deleteSchedule(id: number): Promise<void> {
    await this.sp.web.lists
      .getByTitle(LIST_NAMES.SCHEDULES)
      .items.getById(id)
      .delete();
  }

  // ─── Attendance ────────────────────────────────────────────

  public async getAttendanceByDate(date: Date): Promise<IAttendanceStatus[]> {
    const dateStr = date.toISOString().split('T')[0];

    const items = await this.sp.web.lists
      .getByTitle(LIST_NAMES.ATTENDANCE)
      .items.select('Id', 'MemberId', 'Member/Title', 'Date', 'Status', 'Note')
      .expand('Member')
      .filter(`Date eq datetime'${dateStr}T00:00:00Z'`)();

    return items.map((item: any) => ({
      id: item.Id,
      memberId: item.MemberId,
      memberName: item.Member?.Title,
      date: new Date(item.Date),
      status: item.Status as AttendanceStatusType,
      note: item.Note,
    }));
  }

  public async setAttendance(
    memberId: number,
    date: Date,
    status: AttendanceStatusType,
    note?: string
  ): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    const existing = await this.sp.web.lists
      .getByTitle(LIST_NAMES.ATTENDANCE)
      .items.filter(`MemberId eq ${memberId} and Date eq datetime'${dateStr}T00:00:00Z'`)
      .top(1)();

    if (existing.length > 0) {
      await this.sp.web.lists
        .getByTitle(LIST_NAMES.ATTENDANCE)
        .items.getById(existing[0].Id)
        .update({ Status: status, Note: note || '' });
    } else {
      await this.sp.web.lists
        .getByTitle(LIST_NAMES.ATTENDANCE)
        .items.add({
          Title: `${memberId}_${dateStr}`,
          MemberId: memberId,
          Date: `${dateStr}T00:00:00Z`,
          Status: status,
          Note: note || '',
        });
    }
  }

  // ─── Todos ─────────────────────────────────────────────────

  public async getTodosByMember(memberId: number): Promise<ITodo[]> {
    const items = await this.sp.web.lists
      .getByTitle(LIST_NAMES.TODOS)
      .items.select('Id', 'Title', 'AssigneeId', 'Assignee/Title', 'Status', 'Priority', 'DueDate', 'Memo')
      .expand('Assignee')
      .filter(`AssigneeId eq ${memberId}`)
      .orderBy('Priority')();

    return items.map((item: any) => ({
      id: item.Id,
      title: item.Title,
      assigneeId: item.AssigneeId,
      assigneeName: item.Assignee?.Title,
      status: item.Status as TodoStatus,
      priority: item.Priority as TodoPriority,
      dueDate: item.DueDate ? new Date(item.DueDate) : undefined,
      memo: item.Memo,
    }));
  }

  public async addTodo(todo: Omit<ITodo, 'id' | 'assigneeName'>): Promise<ITodo> {
    const result = await this.sp.web.lists
      .getByTitle(LIST_NAMES.TODOS)
      .items.add({
        Title: todo.title,
        AssigneeId: todo.assigneeId,
        Status: todo.status,
        Priority: todo.priority,
        DueDate: todo.dueDate?.toISOString() || null,
        Memo: todo.memo || '',
      });

    return { ...todo, id: result.Id };
  }

  public async updateTodo(id: number, todo: Partial<ITodo>): Promise<void> {
    const updateData: any = {};
    if (todo.title !== undefined) updateData.Title = todo.title;
    if (todo.status !== undefined) updateData.Status = todo.status;
    if (todo.priority !== undefined) updateData.Priority = todo.priority;
    if (todo.dueDate !== undefined) updateData.DueDate = todo.dueDate?.toISOString() || null;
    if (todo.memo !== undefined) updateData.Memo = todo.memo;

    await this.sp.web.lists
      .getByTitle(LIST_NAMES.TODOS)
      .items.getById(id)
      .update(updateData);
  }

  public async deleteTodo(id: number): Promise<void> {
    await this.sp.web.lists
      .getByTitle(LIST_NAMES.TODOS)
      .items.getById(id)
      .delete();
  }

  // ─── Workload Status ───────────────────────────────────────

  public async getWorkloadStatuses(): Promise<IWorkloadStatus[]> {
    const items = await this.sp.web.lists
      .getByTitle(LIST_NAMES.WORKLOAD)
      .items.select('Id', 'MemberId', 'Member/Title', 'Status', 'UpdatedAt', 'UpdatedBy/Title')
      .expand('Member', 'UpdatedBy')();

    return items.map((item: any) => ({
      id: item.Id,
      memberId: item.MemberId,
      memberName: item.Member?.Title,
      status: item.Status as WorkloadStatusType,
      updatedAt: new Date(item.UpdatedAt),
      updatedBy: item.UpdatedBy?.Title,
    }));
  }

  public async toggleWorkloadStatus(memberId: number): Promise<WorkloadStatusType> {
    const existing = await this.sp.web.lists
      .getByTitle(LIST_NAMES.WORKLOAD)
      .items.filter(`MemberId eq ${memberId}`)
      .top(1)();

    const newStatus: WorkloadStatusType =
      existing.length > 0 && existing[0].Status === 'NeedSupport'
        ? 'Normal'
        : 'NeedSupport';

    if (existing.length > 0) {
      await this.sp.web.lists
        .getByTitle(LIST_NAMES.WORKLOAD)
        .items.getById(existing[0].Id)
        .update({
          Status: newStatus,
          UpdatedAt: new Date().toISOString(),
        });
    } else {
      await this.sp.web.lists
        .getByTitle(LIST_NAMES.WORKLOAD)
        .items.add({
          Title: `workload_${memberId}`,
          MemberId: memberId,
          Status: newStatus,
          UpdatedAt: new Date().toISOString(),
        });
    }

    return newStatus;
  }

  // ─── Dashboard ─────────────────────────────────────────────

  public async getDashboardSummary(): Promise<{
    attendance: IAttendanceStatus[];
    workload: IWorkloadStatus[];
    todosInProgress: number;
  }> {
    const today = new Date();
    const [attendance, workload, todos] = await Promise.all([
      this.getAttendanceByDate(today),
      this.getWorkloadStatuses(),
      this.sp.web.lists
        .getByTitle(LIST_NAMES.TODOS)
        .items.filter("Status eq '진행중'")
        .select('Id')(),
    ]);

    return {
      attendance,
      workload,
      todosInProgress: todos.length,
    };
  }
}
