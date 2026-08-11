/**
 * TeamSchedule.aspx를 SharePoint SitePages에 업로드
 * F12 Console에서 실행
 */
(async function uploadAspx() {
  const siteUrl = 'https://lgeteams.sharepoint.com/sites/packing_part_schedule';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.aspx,.html';

  input.onchange = async function () {
    const file = input.files[0];
    if (!file) return;
    console.log('📤 업로드 시작:', file.name, `(${(file.size / 1024).toFixed(1)} KB)`);

    try {
      const digestRes = await fetch(`${siteUrl}/_api/contextinfo`, {
        method: 'POST',
        headers: { 'Accept': 'application/json;odata=nometadata' }
      });
      const digest = (await digestRes.json()).FormDigestValue;
      const buffer = await file.arrayBuffer();

      // SitePages 폴더에 업로드
      const folders = ['SitePages', 'SiteAssets', 'Shared Documents'];
      let success = false;

      for (const folder of folders) {
        try {
          const uploadUrl = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('/sites/packing_part_schedule/${folder}')/Files/add(url='TeamSchedule.aspx',overwrite=true)`;
          const res = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=nometadata', 'X-RequestDigest': digest },
            body: buffer
          });
          if (res.ok) {
            const fileUrl = `${siteUrl}/${folder}/TeamSchedule.aspx`;
            console.log('');
            console.log('═══════════════════════════════════════════════════');
            console.log(`  ✅ 업로드 성공! (${folder})`);
            console.log('═══════════════════════════════════════════════════');
            console.log('  📍 접속 URL:');
            console.log(`  ${fileUrl}`);
            console.log('');
            window.open(fileUrl, '_blank');
            success = true;
            break;
          }
        } catch (e) {
          console.log(`  ⚠️ ${folder} 업로드 실패, 다음 시도...`);
        }
      }

      if (!success) {
        console.error('❌ 모든 폴더 업로드 실패');
        console.log('💡 수동: 사이트 콘텐츠 → SitePages → 업로드 → TeamSchedule.aspx');
      }
    } catch (error) {
      console.error('❌ 오류:', error.message);
    }
  };

  input.click();
})();
