# 신규 식별자 충돌 검토 — naming_collision

## 검증 방법 메모

`_prompts/naming_collision.md` 에 첨부된 target 문서 페이로드는 `spec/5-system/` 디렉토리
전체(1-auth.md, 그래프/검색 관련 문서, API 카탈로그 컨벤션 등)를 컨텍스트로 담고 있으나,
실제 이번 변경의 diff 범위는 그중 극히 일부다. 페이로드 텍스트를 그대로 신뢰하지 않고
지시받은 대로 `git diff origin/main...HEAD` 로 REAL diff 를 직접 확인했다:

```
codebase/backend/src/modules/mcp/mcp-error-codes.spec.ts        |  6 +--
codebase/backend/src/modules/mcp/mcp-error-codes.ts             | 15 +++---
codebase/backend/src/shared/utils/sanitize-error-message.spec.ts| 20 ++++--
codebase/backend/src/shared/utils/sanitize-error-message.ts     | 15 ++--
review/code/2026/07/10/10_54_39/*.md (신규, 리뷰 산출물)
review/code/2026/07/10/11_04_04/*.md (신규, 리뷰 산출물)
spec/5-system/11-mcp-client.md                                  |  6 ++-
```

`git show origin/main:.../sanitize-error-message.ts` / `mcp-error-codes.ts` 로 대조한 결과
`SECRET_LEAK_PATTERNS`, `MCP_EXTRA_SECRET_PATTERNS`, `redactMcpSecrets`,
`sanitizeMcpErrorMessage` 는 모두 이미 `origin/main`(PR #886, "SECRET_LEAK_PATTERNS 확장")
에 존재하던 식별자이며 이번 diff 가 새로 도입한 것이 아니다. 이번 변경은:

1. `SECRET_LEAK_PATTERNS` 배열 내 기존 URI-userinfo 정규식 **1개를 교체**
   (`/\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s:@]+@/gi` → scheme-preserving
   lookbehind/lookahead `/(?<=:\/\/)[^/\s:@]+:[^/\s@]+(?=@)/gi`) — 배열 이름·export 는 불변.
2. `MCP_EXTRA_SECRET_PATTERNS` 배열에서 URL-userinfo 항목 **1개를 제거**(중복 SoT 통합) —
   신규 항목 추가 없음, 배열 이름·export 는 불변.
3. `spec/5-system/11-mcp-client.md` §8.2 표 셀 문구와 §8.3 산문 갱신(신규 requirement ID·
   신규 섹션 없음, 기존 §8.2/§8.3 번호 유지) + 후속 안내 인용구(blockquote) 1단락 추가.
4. 두 `*.spec.ts` 의 `it(...)` 설명 문자열 및 어서션 값 변경 — 식별자가 아닌 텍스트.
5. `review/code/2026/07/10/10_54_39/` · `review/code/2026/07/10/11_04_04/` 신규 리뷰 산출물
   디렉토리 — 관례(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)를 따르는 타임스탬프 경로.

즉 새로 **도입**된 요구사항 ID, 엔티티/타입명, API endpoint, 이벤트/메시지명, 환경변수/설정키,
파일 경로(신규 spec 파일)는 이번 diff 에 존재하지 않는다. 아래는 6개 관점별 확인 결과다.

## 발견사항

관점별로 신규 식별자 도입 여부를 확인했으며, CRITICAL/WARNING 급 충돌은 발견되지 않았다.

- **[INFO]** 신규 식별자 없음 — 6개 관점 전수 확인
  - target 신규 식별자: 없음(regex 리터럴 교체·배열 항목 제거·주석/spec 산문 갱신만 발생)
  - 기존 사용처: `codebase/backend/src/shared/utils/sanitize-error-message.ts:30`
    (`SECRET_LEAK_PATTERNS`, PR #886 origin/main 기존 export),
    `codebase/backend/src/modules/mcp/mcp-error-codes.ts:47,68`
    (`MCP_EXTRA_SECRET_PATTERNS`, `redactMcpSecrets`, 기존 export)
  - 상세:
    1. **요구사항 ID** — `spec/5-system/11-mcp-client.md` diff 는 §8.2/§8.3 기존 섹션 번호
       내에서 표 셀·산문만 수정했고, blockquote 로 "2026-07-10 갱신" 히스토리 노트를 추가했을
       뿐 신규 하위 절 번호(예: §8.3.1)나 신규 요구사항 ID 를 부여하지 않았다.
    2. **엔티티/타입명** — 새 인터페이스·DTO·클래스 없음. 정규식 리터럴은 이미 존재하는
       `SECRET_LEAK_PATTERNS`/`MCP_EXTRA_SECRET_PATTERNS` 배열의 원소(값)일 뿐 별도로
       export 되는 이름이 아니다.
    3. **API endpoint** — 변경 없음(diff 에 컨트롤러·라우트 파일 없음).
    4. **이벤트/메시지명** — 변경 없음. 마스킹 치환 문자열은 여전히 `***`(placeholder)로
       공용·MCP 두 곳 동일 — 신규 placeholder 문자열이 도입되지 않아 표기 충돌 여지 없음.
    5. **환경변수·설정키** — 변경 없음.
    6. **파일 경로** — `spec/5-system/11-mcp-client.md` 는 기존 파일(수정만). 신규 생성된
       `review/code/2026/07/10/{10_54_39,11_04_04}/*.md` 는 코드 리뷰 산출물 관례 경로이며,
       동일 트리 내 다른 타임스탬프 디렉토리(`00_00_42` … `11_04_04`)와 겹치지 않음을
       `ls review/code/2026/07/10/` 로 확인.
  - 제안: 해당 없음(조치 불필요). 향후 유사 검토에서 target 페이로드가 디렉토리 전체
    컨텍스트를 포함할 경우, 실제 diff 범위(파일 3~4개)를 우선 확정한 뒤 그 범위 안에서만
    "신규" 여부를 판정할 것 — 페이로드에 포함된 방대한 기존 문서(예: `1-auth.md`)의 기존
    식별자를 "target 이 새로 도입"한 것으로 오인하지 않도록 주의.

## 요약

REAL diff(`git diff origin/main...HEAD`)를 기준으로 볼 때 이번 변경은 신규 식별자를
전혀 도입하지 않는다 — 공용 `SECRET_LEAK_PATTERNS`(PR #886 기존 export) 내 URI-userinfo
정규식 1개를 scheme-preserving 형태로 교체하고, MCP 전용 `MCP_EXTRA_SECRET_PATTERNS`에서
같은 의미의 중복 항목 1개를 제거해 SoT 를 통합했으며, `spec/5-system/11-mcp-client.md`
§8.2/§8.3 은 기존 섹션 번호 안에서 문구만 갱신했다. 요구사항 ID·엔티티/타입명·API
endpoint·이벤트명·환경변수·신규 spec 파일 경로 어느 관점에서도 새로 부여된 이름이 없어
기존 사용처와 충돌할 대상 자체가 존재하지 않는다.

## 위험도

NONE
