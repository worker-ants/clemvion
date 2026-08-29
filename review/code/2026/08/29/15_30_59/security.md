# Security Review

## 리뷰 범위

- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `extractLinks()` 재구현: 줄 단위 `LINK_RE` 매칭을 버리고, 펜스/빈 줄을 `]` 로 마스킹한 전문(全文)을 한 번에 매칭 + 오프셋→원본줄 이진 탐색(`buildMaskedDoc`, `lineForOffset`)으로 분리.
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — 위 재구현에 대한 멀티라인 링크 negative/positive 회귀 테스트 추가.
- `plan/in-progress/harness-review-gate-followups.md` — plan 서술 갱신 (체크박스 flip, 뮤테이션 실측 표 추가, 코드 변경 없음).
- `review/code/2026/08/29/{14_36_39,15_01_34}/**` — 직전 리뷰 라운드의 산출물(SUMMARY/RESOLUTION/각 reviewer report/`_retry_state.json`/`meta.json`)이 신규 파일로 커밋되는 것. 실행 코드가 아닌 리포트 텍스트이며 시크릿·자격증명 포함 여부만 확인 대상.

이 모듈은 프로덕션 런타임 코드가 아니라 **개발/테스트 시점에만 도는 사내 문서 링크 무결성 가드**다. 입력은 저장소 자신의 `spec/**`·거버넌스(`*.md`, `.claude/**.md`)·`plan/in-progress/**`·`codebase/**` 소스 파일이며, 신뢰 경계를 넘는 외부 사용자 입력이나 네트워크 요청을 처리하지 않는다.

## 발견사항

- **[INFO]** 링크 타깃 경로 해석이 상위 디렉터리 이탈을 정규화·화이트리스트하지 않는다 (기존 로직, 이번 diff 로 변경되지 않음)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `findBrokenLinksInFiles` 함수 내부, `const resolved = path.resolve(path.dirname(f.absPath), pathPart);` (약 330행) 및 다음 줄의 `fs.existsSync(resolved)` (331행).
  - 상세: `pathPart` 는 마크다운 링크 목적지 문자열을 그대로 쓰며 `../../../etc/...` 형태의 경로 이탈을 막는 로직이 없다. 다만 입력 출처가 저장소 안의 사람이 작성한 markdown(신뢰 입력)이고, 노출되는 결과도 파일 내용이 아니라 "DEAD/존재 여부" 판정뿐이라 현재 스코프(self-audit devtool)에서는 실질 공격 표면이 없다. 이 PR 은 매칭 방식(줄 단위 → 마스킹 전문)만 바꿨을 뿐 이 함수는 손대지 않았다.
  - 제안: 조치 불요. 향후 이 헬퍼를 신뢰되지 않는 소스(예: 사용자 제출 markdown)에 재사용할 계획이 생기면 그때 정규화/화이트리스트를 추가한다.

- **[INFO]** 신규 `LINK_RE`(`/\[([^\]]*)\]\(([^)\n]+)\)/g`)는 ReDoS 위험이 없다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `const LINK_RE = ...` 선언부 (82행).
  - 상세: 이번 PR 은 줄 단위 매칭을 버리고 마스킹된 전문 전체를 한 번에 `LINK_RE.exec()` 로 매칭해 스캔 대상 문자열 길이가 파일 전체로 늘었다. `[^\]]*` 와 `[^)\n]+` 는 모두 부정 문자 클래스에 대한 단일(비중첩) 정량자이고 서로 다른 문자 클래스를 배타적으로 소비하므로 `(a+)+` 류 중첩 정량자로 인한 catastrophic backtracking 이 발생하지 않는다. `LINK_RE.lastIndex = 0` 을 매 호출 재설정하는 점도 올바르다(모듈 스코프 공유 정규식의 `g` 플래그 상태 오염 방지). 이번 PR 의 `plan/in-progress/harness-review-gate-followups.md` 뮤테이션 실측(전수 스캔 GREEN 유지)도 선형 동작과 일치한다.
  - 제안: 조치 불요.

- **[INFO]** `buildMaskedDoc` / `lineForOffset` 의 새 매핑 로직은 신뢰 경계·인젝션 표면을 추가하지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `function buildMaskedDoc(text: string): MaskedDoc` (약 124행) / `function lineForOffset(doc: MaskedDoc, offset: number): number` (약 156행).
  - 상세: 두 함수 모두 순수 문자열/배열 변환이며 외부 프로세스 실행, 파일 시스템 쓰기, 동적 코드 평가(`eval`류) 가 없다. 이진 탐색 경계도 `doc.startOf.length - 1` 로 배열 범위 내로 고정돼 있어 인덱스 아웃오브바운드로 인한 크래시/정보노출 벡터가 없다.
  - 제안: 조치 불요.

- **[INFO]** 테스트 픽스처의 임시 디렉터리 사용은 안전 (TOCTOU/경합 없음)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — 신규 `describe("extractLinks — 링크 텍스트가 줄을 넘어도 본다")` 및 `describe("멀티라인 링크의 깨진 타깃도 잡힌다")` 블록의 `fs.mkdtempSync(path.join(os.tmpdir(), ...))` (예: 278행, 389행) / `afterAll(() => fs.rmSync(root, { recursive: true, force: true }))` (283행, 397행).
  - 상세: `mkdtempSync` 는 예측 불가능한 유일 디렉터리명을 생성하고, 각 `describe` 는 자기 `root` 만 재귀 삭제한다(고정 경로·와일드카드·심볼릭 링크 추적 없음). 다른 프로세스와 공유되는 자리를 쓰지 않아 경쟁 상태로 인한 임의 경로 삭제 위험이 없다.
  - 제안: 조치 불요.

- **[INFO]** `plan/**`, `review/code/**` 신규/변경 markdown 에 하드코딩 시크릿·자격증명 없음
  - 위치: `plan/in-progress/harness-review-gate-followups.md` 전체 diff, `review/code/2026/08/29/{14_36_39,15_01_34}/**` 신규 파일 전체.
  - 상세: 서술·뮤테이션 실측 표·이전 라운드 리뷰 리포트(SUMMARY/RESOLUTION/`_retry_state.json`/`meta.json` 등) 전부 확인. API 키·비밀번호·토큰·인증서·연결 문자열 패턴이 없으며, `_retry_state.json` 은 로컬 절대경로(`/Users/gehrig/...`)와 세션 상태만 담고 있어 민감정보 노출이 아니다.
  - 제안: 조치 불요.

## 요약

이번 변경은 사내 문서 링크 무결성 가드(`extractLinks`)를 줄 단위 매칭에서 마스킹-전문 매칭으로 재구현한 devtool 코드이며, 신뢰 경계를 넘는 사용자 입력이나 네트워크 요청을 처리하지 않는다. 하드코딩된 시크릿, SQL/XSS/커맨드 인젝션, 인증/인가 로직, 안전하지 않은 암호화·평문 전송이 전혀 없고, 새로 도입된 정규식과 마스킹/이진탐색 로직도 ReDoS·인덱스 오류·인젝션 표면을 만들지 않는다. 유일하게 반복 언급되는 사항은 기존부터 있던 `path.resolve` 기반 경로 해석이 정규화되지 않는다는 점이지만, 입력이 저장소 자신의 신뢰된 markdown 이고 노출 결과도 존재 여부뿐이라 현재 스코프에서는 정보성(INFO) 수준이다. 함께 커밋되는 이전 리뷰 라운드 산출물(`review/code/**`)도 순수 리포트 텍스트로 시크릿이나 실행 가능한 위험 요소가 없다.

## 위험도

NONE
