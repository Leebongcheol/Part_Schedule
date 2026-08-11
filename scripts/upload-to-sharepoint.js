/**
 * index.html 파일을 SharePoint SiteAssets에 업로드하는 스크립트
 * 
 * 사용법:
 * 1. https://lgeteams.sharepoint.com/sites/packing_part_schedule/ 에서 F12 Console
 * 2. allow pasting 입력 후 Enter
 * 3. 이 스크립트 붙여넣기 후 Enter
 * 4. 파일 선택 창에서 index.html 선택
 */
(async function uploadToSharePoint() {
  const siteUrl = 'https://lgeteams.sharepoint.com/sites/packing_part_schedule';

  // 파일 선택 UI
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.html';

  input.onchange = async function () {
    const file = input.files[0];
    if (!file) return;

    console.log('📤 업로드 시작:', file.name, `(${(file.size / 1024).toFixed(1)} KB)`);

    try {
      // Digest 가져오기
      const digestRes = await fetch(`${siteUrl}/_api/contextinfo`, {
        method: 'POST',
        headers: { 'Accept': 'application/json;odata=nometadata' }
      });
      const digestData = await digestRes.json();
      const digest = digestData.FormDigestValue;

      // 파일 읽기
      const buffer = await file.arrayBuffer();

      // SiteAssets에 업로드
      const uploadUrl = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('/sites/packing_part_schedule/SiteAssets')/Files/add(url='TeamSchedule.html',overwrite=true)`;

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'X-RequestDigest': digest
        },
        body: buffer
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`${res.status}: ${err}`);
      }

      const result = await res.json();
      const fileUrl = `${siteUrl}/SiteAssets/TeamSchedule.html`;

      console.log('');
      console.log('═══════════════════════════════════════════════════');
      console.log('  ✅ 업로드 성공!');
      console.log('═══════════════════════════════════════════════════');
      console.log('');
      console.log('  📍 접속 URL:');
      console.log(`  ${fileUrl}`);
      console.log('');
      console.log('  👉 위 URL을 팀원들에게 공유하세요!');
      console.log('');

      // 자동으로 새 탭에서 열기
      window.open(fileUrl, '_blank');

    } catch (error) {
      console.error('❌ 업로드 실패:', error.message);

      // SiteAssets 폴더가 없는 경우 Shared Documents에 시도
      console.log('📁 SiteAssets 접근 실패, Shared Documents로 재시도...');
      try {
        const digestRes2 = await fetch(`${siteUrl}/_api/contextinfo`, {
          method: 'POST',
          headers: { 'Accept': 'application/json;odata=nometadata' }
        });
        const digestData2 = await digestRes2.json();
        const digest2 = digestData2.FormDigestValue;

        const buffer2 = await file.arrayBuffer();
        const uploadUrl2 = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('/sites/packing_part_schedule/Shared Documents')/Files/add(url='TeamSchedule.html',overwrite=true)`;

        const res2 = await fetch(uploadUrl2, {
          method: 'POST',
          headers: {
            'Accept': 'application/json;odata=nometadata',
            'X-RequestDigest': digest2
          },
          body: buffer2
        });

        if (!res2.ok) throw new Error(await res2.text());

        const fileUrl2 = `${siteUrl}/Shared Documents/TeamSchedule.html`;
        console.log('');
        console.log('═══════════════════════════════════════════════════');
        console.log('  ✅ 업로드 성공! (Shared Documents)');
        console.log('═══════════════════════════════════════════════════');
        console.log(`  📍 접속 URL: ${fileUrl2}`);
        console.log('');
        window.open(fileUrl2, '_blank');

      } catch (err2) {
        console.error('❌ 재시도도 실패:', err2.message);
        console.log('💡 수동 업로드: 사이트 콘텐츠 → SiteAssets 또는 문서 → 업로드 → index.html');
      }
    }
  };

  input.click();
})();
