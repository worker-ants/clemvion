STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — masked-marker-contract-7d2e14 (라운드 5, 13_14_29)

## 검토 방법

이 PR 은 이미 4라운드(`11_27_29`→`11_53_49`→`12_25_15`→`12_50_37`)에 걸쳐 side_effect 관점을
포함한 다수 reviewer 가 검토했고, 매 라운드 지적이 다음 커밋에서 수정돼 왔다(`bf0618a7d` →
`1f63bbbef` → `811a40f48` → `4dca96cc4`). 이번 라운드는 **HEAD(`4dca96cc4`)의 실제 코드**를
직접 `Read`/`grep` 로 재확인해 이전 라운드가 "고쳤다"고 처분한 항목이 실제로 양쪽 스택에
대칭 반영됐는지, 그리고 새로 부작용 관점 결함이 있는지를 확인했다.

- `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` 전문
- `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` 전문
- `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts` 전문
- `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts` 전문
- `codebase/packages/masked-markers/{package.json,src/index.ts}` 전문
- `grep` 으로 `MASKED_MARKERS`/`isMaskedMarker`/`MAX_REDACT_DEPTH`/`VALUE_MASK_MARKER` 등
  기존 소비처 전수(backend `websocket.service.ts`/`reject-masked-resubmission.ts`/
  `interaction.service.ts`/`strip-external-only-fields.ts`, frontend `rerun-modal.tsx`/
  `dynamic-form-ui.tsx`) 조회 — 전부 재export 경로(`sanitize-error-message.ts`/
  `masked-markers.ts`)로만 import, 시그니처·값 무변경 확인.
- `codebase/{backend,frontend}/package.json` 의 `@workflow/masked-markers` 가 `dependencies`
  (devDependencies 아님)에 있는지 직접 파싱 확인.

## 발견사항

새로 발견된 CRITICAL/WARNING 급 부작용 결함은 없다. 직전 라운드(`12_50_37`)가 WARNING 으로
지적한 **backend/frontend 미러 가드의 `SOT_DIR` 접두 경계 비대칭**(backend 만
`=== SOT_DIR || startsWith(SOT_DIR + '/')` 로 수정되고 frontend 는 경계 없는 `startsWith`
그대로였던 문제 — fail-open 성격의 보안 회귀 방지 컨트롤 결함)은 커밋 `4dca96cc4` 에서 **양쪽
모두 동일한 경계 조건**으로 수정됐고(backend `masked-marker-mirror-guard.ts:141`, frontend
`:143-144`), 두 스펙 파일 모두 그 경계를 직접 묻는 캐너리(`SoT 와 접두가 겹치는 형제 패키지는
탐지 대상이다`, `tmp` 합성 fixture 사용)를 갖춰 향후 비대칭 재발도 기계로 잡히는 상태임을
확인했다.

이하는 이전 라운드들에서 이미 식별·판정된 INFO 성격 관측을 이번 라운드 기준으로 재확인한
것이며, 실질 위험이나 조치 필요 사항은 아니다.

- **[INFO]** 신규 미러 소멸 캐너리 테스트(backend `masked-marker-mirror.spec.ts`, frontend
  `masked-marker-mirror.test.ts`)가 각각 두 곳에서 `os.tmpdir()` 밑에 `fs.mkdtempSync` →
  `fs.writeFileSync` → `finally { fs.rmSync(..., { recursive: true, force: true }) }` 패턴으로
  임시 파일을 만든다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts` 의
    `it('[캐너리] 실제 재선언을 지목한다 (합성 fixture)', ...)`(88-108행) 및
    `it('[캐너리] SoT 와 접두가 겹치는 형제 패키지는 탐지 대상이다', ...)`(133-158행);
    frontend `masked-marker-mirror.test.ts` 의 대응 테스트 2개(102-123행, 146-165행) — 4곳
    전부 동일 try/finally 패턴.
  - 상세: 단언이 실패해도 `finally` 가 실행돼 임시 디렉터리가 남지 않는다. 저장소 소스
    트리 밖(OS 임시 디렉터리)에서만 쓰고 지우므로 실제 저장소 파일시스템에 대한 부작용은
    없다. 4곳 모두 동일 패턴이라 하나만 놓치는 비대칭 위험도 없다.
  - 제안: 없음(정상 패턴, 기록 목적).

- **[INFO]** `MASKED_MARKERS` 의 프런트 타입이 `ReadonlySet<string>` → `readonly string[]` 로
  구조 변경됐으나 실제 소비처 영향 없음 (이전 라운드에서 이미 확인, 재확인 결과 동일).
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:56`
    (`export { isMaskedMarker, MASKED_MARKERS };` — 패키지 재export).
  - 상세: `grep -rn "MASKED_MARKERS" codebase/frontend/src`(테스트 제외)로 전수 재확인한
    결과 이 심볼을 직접 소비하는 프로덕션 코드는 없다(`isMaskedMarker`/
    `hasMaskedMarkerLeaf` 를 통해서만 간접 사용). `.has()` 를 직접 호출하는 소비처가
    있었다면 컴파일 타임에 즉시 깨졌을 것이나 그런 소비처는 없다.
  - 제안: 없음(조치 불요, 과거 라운드와 동일 결론).

- **[INFO]** 신규 패키지 `codebase/packages/masked-markers/package.json` 의 `prepare`
  스크립트가 `pnpm install` 시 `tsc` 를 서브프로세스로 실행해 `dist/` 를 생성한다 — 새로운
  부작용이 아니라 이 저장소의 기존 8개 내부 패키지(`ai-end-reason` 등)와 바이트 단위로 동일한
  기존 관행의 9번째 복제다.
  - 위치: `codebase/packages/masked-markers/package.json` (`scripts.prepare`).
  - 상세: `child_process.execSync('tsc', {stdio:'inherit'})` 를 호출해 패키지 디렉터리
    내부(`dist/`)에만 쓴다. 저장소 밖이나 무관한 경로에 쓰지 않고, 선례 패키지들과 완전히
    동일한 코드라 이 PR 이 새로 도입한 위험이 아니다.
  - 제안: 없음(범위 밖, 과거 라운드 maintainability 리뷰에서 동일 판정).

## 요약

이 변경의 핵심은 backend `sanitize-error-message.ts` 와 frontend `lib/utils/masked-markers.ts`
에 손으로 복제돼 있던 마스킹 마커 상수·판정 함수·깊이 상한을 `@workflow/masked-markers` 공유
패키지로 추출하고, 두 소비처는 **이름·시그니처를 그대로 유지한 채 재export**하는 것이다.
기존 함수 시그니처(`isMaskedMarker(v: unknown): boolean`)와 마커 값(`'***'`/`'[REDACTED]'`/
`'[REDACTED_DEPTH]'`/깊이 `10`)은 이관 전후 동일해 `interaction.service.ts`·
`reject-masked-resubmission.ts`·`websocket.service.ts`·`strip-external-only-fields.ts`(backend)
및 `rerun-modal.tsx`·`dynamic-form-ui.tsx`(frontend) 등 기존 소비처 전부 영향이 없다.
새로 신설된 backend/frontend 미러 소멸 가드는 5라운드에 걸쳐 반복적으로 자기 자신의 사각지대
(CI 경로 게이팅 무방비 → 감시 목록 자체가 미러 → 스캔 파생이 얕음 → 접두 경계 비대칭)를
스스로 드러내고 닫아 왔으며, 직전 라운드가 지적한 마지막 비대칭(frontend 접두 경계 미수정)도
이번 HEAD 에서 backend 와 완전히 대칭으로 수정됐고 그 경계를 직접 검증하는 캐너리까지
양쪽에 존재함을 직접 코드로 확인했다. 전역 변수·환경 변수·네트워크 호출·이벤트/콜백 변경은
diff 어디에도 없고, 신규 테스트의 파일시스템 부작용(임시 디렉터리)은 4곳 모두 try/finally 로
격리·정리된다. CRITICAL/WARNING 급 부작용 결함은 발견되지 않았다.

## 위험도
NONE
