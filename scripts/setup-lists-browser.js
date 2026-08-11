/**
 * Team Schedule - SharePoint List 자동 생성 스크립트
 * 
 * 사용법:
 * 1. 브라우저에서 https://lgeteams.sharepoint.com/sites/packing_part_schedule/ 접속
 * 2. F12 → Console 탭 열기
 * 3. 이 스크립트 전체를 복사하여 콘솔에 붙여넣기
 * 4. Enter 실행
 */

(async function setupTeamSchedule() {
  const siteUrl = 'https://lgeteams.sharepoint.com/sites/packing_part_schedule';
  
  console.log('🚀 Team Schedule 설정을 시작합니다...');
  console.log('📍 사이트:', siteUrl);

  // ─── 헬퍼 함수 ─────────────────────────────────────────────

  async function getDigest() {
    const res = await fetch(`${siteUrl}/_api/contextinfo`, {
      method: 'POST',
      headers: { 'Accept': 'application/json;odata=nometadata' }
    });
    const data = await res.json();
    return data.FormDigestValue;
  }

  async function spPost(endpoint, body) {
    const digest = await getDigest();
    const res = await fetch(`${siteUrl}/_api/${endpoint}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=verbose',
        'X-RequestDigest': digest
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`${res.status}: ${err}`);
    }
    return res.json();
  }

  async function createList(title, description) {
    try {
      await spPost('web/lists', {
        '__metadata': { 'type': 'SP.List' },
        'Title': title,
        'Description': description || '',
        'BaseTemplate': 100,
        'AllowContentTypes': true
      });
      console.log(`  ✅ 리스트 생성: ${title}`);
    } catch (e) {
      if (e.message.includes('-2130575342') || e.message.includes('already exists') || e.message.includes('이미')) {
        console.log(`  ℹ️  리스트 이미 존재: ${title} (건너뜀)`);
      } else {
        console.warn(`  ⚠️  리스트 생성 실패 (${title}):`, e.message.substring(0, 150));
      }
      // 실패해도 계속 진행 (이미 존재하는 경우 열 추가는 가능)
    }
  }

  async function addTextField(listTitle, fieldName, required) {
    try {
      await spPost(`web/lists/getbytitle('${listTitle}')/fields`, {
        '__metadata': { 'type': 'SP.Field' },
        'Title': fieldName,
        'StaticName': fieldName,
        'InternalName': fieldName,
        'FieldTypeKind': 2,
        'Required': required || false
      });
      console.log(`    + 열 추가: ${fieldName} (텍스트)`);
    } catch (e) {
      if (e.message.includes('duplicate') || e.message.includes('already exists') || e.message.includes('중복') || e.message.includes('이미')) {
        console.log(`    ℹ️  열 이미 존재: ${fieldName}`);
      } else {
        console.warn(`    ⚠️  열 추가 실패 (${fieldName}):`, e.message.substring(0, 100));
      }
    }
  }

  async function addNoteField(listTitle, fieldName) {
    try {
      await spPost(`web/lists/getbytitle('${listTitle}')/fields`, {
        '__metadata': { 'type': 'SP.FieldMultiLineText' },
        'Title': fieldName,
        'StaticName': fieldName,
        'InternalName': fieldName,
        'FieldTypeKind': 3,
        'NumberOfLines': 6,
        'RichText': false
      });
      console.log(`    + 열 추가: ${fieldName} (여러줄 텍스트)`);
    } catch (e) {
      if (e.message.includes('duplicate') || e.message.includes('already exists') || e.message.includes('중복') || e.message.includes('이미')) {
        console.log(`    ℹ️  열 이미 존재: ${fieldName}`);
      } else {
        console.warn(`    ⚠️  열 추가 실패 (${fieldName}):`, e.message.substring(0, 100));
      }
    }
  }

  async function addChoiceField(listTitle, fieldName, choices, defaultValue) {
    try {
      await spPost(`web/lists/getbytitle('${listTitle}')/fields`, {
        '__metadata': { 'type': 'SP.FieldChoice' },
        'Title': fieldName,
        'StaticName': fieldName,
        'InternalName': fieldName,
        'FieldTypeKind': 6,
        'Choices': { '__metadata': { 'type': 'Collection(Edm.String)' }, 'results': choices },
        'DefaultValue': defaultValue || null
      });
      console.log(`    + 열 추가: ${fieldName} (선택: ${choices.join(', ')})`);
    } catch (e) {
      if (e.message.includes('duplicate') || e.message.includes('already exists') || e.message.includes('중복') || e.message.includes('이미')) {
        console.log(`    ℹ️  열 이미 존재: ${fieldName}`);
      } else {
        console.warn(`    ⚠️  열 추가 실패 (${fieldName}):`, e.message.substring(0, 100));
      }
    }
  }

  async function addDateField(listTitle, fieldName, dateOnly) {
    try {
      await spPost(`web/lists/getbytitle('${listTitle}')/fields`, {
        '__metadata': { 'type': 'SP.FieldDateTime' },
        'Title': fieldName,
        'StaticName': fieldName,
        'InternalName': fieldName,
        'FieldTypeKind': 4,
        'DisplayFormat': dateOnly ? 1 : 0
      });
      console.log(`    + 열 추가: ${fieldName} (날짜)`);
    } catch (e) {
      if (e.message.includes('duplicate') || e.message.includes('already exists') || e.message.includes('중복') || e.message.includes('이미')) {
        console.log(`    ℹ️  열 이미 존재: ${fieldName}`);
      } else {
        console.warn(`    ⚠️  열 추가 실패 (${fieldName}):`, e.message.substring(0, 100));
      }
    }
  }

  async function addBooleanField(listTitle, fieldName, defaultValue) {
    try {
      await spPost(`web/lists/getbytitle('${listTitle}')/fields`, {
        '__metadata': { 'type': 'SP.Field' },
        'Title': fieldName,
        'StaticName': fieldName,
        'InternalName': fieldName,
        'FieldTypeKind': 8,
        'DefaultValue': defaultValue ? '1' : '0'
      });
      console.log(`    + 열 추가: ${fieldName} (예/아니요)`);
    } catch (e) {
      if (e.message.includes('duplicate') || e.message.includes('already exists') || e.message.includes('중복') || e.message.includes('이미')) {
        console.log(`    ℹ️  열 이미 존재: ${fieldName}`);
      } else {
        console.warn(`    ⚠️  열 추가 실패 (${fieldName}):`, e.message.substring(0, 100));
      }
    }
  }

  async function addUserField(listTitle, fieldName) {
    try {
      await spPost(`web/lists/getbytitle('${listTitle}')/fields`, {
        '__metadata': { 'type': 'SP.FieldUser' },
        'Title': fieldName,
        'StaticName': fieldName,
        'InternalName': fieldName,
        'FieldTypeKind': 20,
        'SelectionMode': 0
      });
      console.log(`    + 열 추가: ${fieldName} (사용자)`);
    } catch (e) {
      if (e.message.includes('duplicate') || e.message.includes('already exists') || e.message.includes('중복') || e.message.includes('이미')) {
        console.log(`    ℹ️  열 이미 존재: ${fieldName}`);
      } else {
        console.warn(`    ⚠️  열 추가 실패 (${fieldName}):`, e.message.substring(0, 100));
      }
    }
  }

  async function addLookupField(listTitle, fieldName, lookupListTitle) {
    try {
      const listRes = await fetch(
        `${siteUrl}/_api/web/lists/getbytitle('${lookupListTitle}')?$select=Id`,
        { headers: { 'Accept': 'application/json;odata=nometadata' } }
      );
      const listData = await listRes.json();
      const lookupListId = listData.Id;

      const digest = await getDigest();
      const fieldXml = `<Field Type="Lookup" DisplayName="${fieldName}" Required="FALSE" ` +
        `List="{${lookupListId}}" ShowField="Title" StaticName="${fieldName}" Name="${fieldName}" />`;

      const res = await fetch(`${siteUrl}/_api/web/lists/getbytitle('${listTitle}')/fields/createfieldasxml`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'Content-Type': 'application/json;odata=verbose',
          'X-RequestDigest': digest
        },
        body: JSON.stringify({
          'parameters': {
            '__metadata': { 'type': 'SP.XmlSchemaFieldCreationInformation' },
            'SchemaXml': fieldXml
          }
        })
      });

      if (!res.ok) throw new Error(await res.text());
      console.log(`    + 열 추가: ${fieldName} (조회 → ${lookupListTitle})`);
    } catch (e) {
      if (e.message.includes('duplicate') || e.message.includes('already exists') || e.message.includes('중복') || e.message.includes('이미')) {
        console.log(`    ℹ️  열 이미 존재: ${fieldName}`);
      } else {
        console.warn(`    ⚠️  조회 열 추가 실패 (${fieldName}):`, e.message.substring(0, 100));
      }
    }
  }

  async function addListItem(listTitle, values) {
    try {
      const listRes = await fetch(
        `${siteUrl}/_api/web/lists/getbytitle('${listTitle}')?$select=ListItemEntityTypeFullName`,
        { headers: { 'Accept': 'application/json;odata=nometadata' } }
      );
      const listData = await listRes.json();
      const itemType = listData.ListItemEntityTypeFullName;

      await spPost(`web/lists/getbytitle('${listTitle}')/items`, {
        '__metadata': { 'type': itemType },
        ...values
      });
    } catch (e) {
      console.warn(`    ⚠️  항목 추가 실패:`, e.message.substring(0, 100));
    }
  }

  // ─── 실행 ───────────────────────────────────────────────────

  try {
    // 1. TeamMembers
    console.log('\n📋 [1/5] TeamMembers 리스트...');
    await createList('TeamMembers', '팀원 정보');
    await addTextField('TeamMembers', 'Color');
    await addTextField('TeamMembers', 'Department');
    await addChoiceField('TeamMembers', 'Role', ['Member', 'Leader'], 'Member');
    await addTextField('TeamMembers', 'Email');
    await addBooleanField('TeamMembers', 'IsActive', true);

    // 초기 팀원 데이터
    console.log('    👥 초기 팀원 데이터 입력...');
    const members = [
      { Title: '이봉철', Color: '#0000FF', Department: '개발팀', Role: 'Leader', Email: 'bclee@company.com', IsActive: '1' },
      { Title: '박상율', Color: '#00AA00', Department: '개발팀', Role: 'Member', Email: 'sypark@company.com', IsActive: '1' },
      { Title: '김철수', Color: '#FF8800', Department: '개발팀', Role: 'Member', Email: 'cskim@company.com', IsActive: '1' },
      { Title: '홍길동', Color: '#9900CC', Department: '개발팀', Role: 'Member', Email: 'gdhong@company.com', IsActive: '1' },
    ];
    for (const m of members) {
      await addListItem('TeamMembers', m);
      console.log(`    ✅ ${m.Title} 추가됨`);
    }

    // 2. Schedules
    console.log('\n📋 [2/5] Schedules 리스트...');
    await createList('Schedules', '일정 정보');
    await addDateField('Schedules', 'StartDate', false);
    await addDateField('Schedules', 'EndDate', false);
    await addNoteField('Schedules', 'Description');
    await addChoiceField('Schedules', 'Category', ['회의', '업무', '기타'], '업무');
    await addBooleanField('Schedules', 'IsRecurring', false);
    await addTextField('Schedules', 'RecurrenceRule');
    await addLookupField('Schedules', 'Assignee', 'TeamMembers');

    // 3. AttendanceStatus
    console.log('\n📋 [3/5] AttendanceStatus 리스트...');
    await createList('AttendanceStatus', '근태 상태');
    await addDateField('AttendanceStatus', 'Date', true);
    await addChoiceField('AttendanceStatus', 'Status', ['출근', '출장', '휴가', '공가', '재택'], '출근');
    await addTextField('AttendanceStatus', 'Note');
    await addLookupField('AttendanceStatus', 'Member', 'TeamMembers');

    // 4. Todos
    console.log('\n📋 [4/5] Todos 리스트...');
    await createList('Todos', '할 일 목록');
    await addChoiceField('Todos', 'Status', ['대기', '진행중', '완료'], '대기');
    await addChoiceField('Todos', 'Priority', ['높음', '보통', '낮음'], '보통');
    await addDateField('Todos', 'DueDate', true);
    await addNoteField('Todos', 'Memo');
    await addLookupField('Todos', 'Assignee', 'TeamMembers');

    // 5. WorkloadStatus
    console.log('\n📋 [5/5] WorkloadStatus 리스트...');
    await createList('WorkloadStatus', '업무부하 상태');
    await addChoiceField('WorkloadStatus', 'Status', ['Normal', 'NeedSupport'], 'Normal');
    await addDateField('WorkloadStatus', 'UpdatedAt', false);
    await addUserField('WorkloadStatus', 'UpdatedBy');
    await addLookupField('WorkloadStatus', 'Member', 'TeamMembers');

    // WorkloadStatus 초기 데이터 - TeamMembers의 각 팀원에 대해
    console.log('    🔧 WorkloadStatus 초기화...');
    const membersRes = await fetch(
      `${siteUrl}/_api/web/lists/getbytitle('TeamMembers')/items?$select=Id,Title`,
      { headers: { 'Accept': 'application/json;odata=nometadata' } }
    );
    const membersData = await membersRes.json();

    for (const m of membersData.value) {
      await addListItem('WorkloadStatus', {
        Title: `workload_${m.Id}`,
        MemberId: m.Id,
        Status: 'Normal',
        UpdatedAt: new Date().toISOString()
      });
      console.log(`    ✅ ${m.Title} WorkloadStatus 초기화됨`);
    }

    // ─── 완료 ──────────────────────────────────────────────────
    console.log('\n');
    console.log('═══════════════════════════════════════════════════');
    console.log('  ✅ 모든 SharePoint List 생성 완료!');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('  생성된 리스트:');
    console.log('  1. TeamMembers (팀원 4명 등록됨)');
    console.log('  2. Schedules (일정)');
    console.log('  3. AttendanceStatus (근태)');
    console.log('  4. Todos (할 일)');
    console.log('  5. WorkloadStatus (업무부하)');
    console.log('');
    console.log('  👉 다음 단계: .sppkg 파일을 App Catalog에 업로드하세요.');
    console.log('');

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }

})();
