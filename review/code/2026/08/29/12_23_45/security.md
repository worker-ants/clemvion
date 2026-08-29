# 보안(Security) 코드 리뷰

## 변경 개요

본 diff는 크게 두 종류로 구성된다.

1. **실제 PR 변경 (파일 1~4)**
   - `expression-resolver.service.spec.ts` — `captureThrown` 헬퍼 추출 + `ExpressionError` 세 하위 클래스(`ExpressionSyntaxError`/`ExpressionReferenceError`/`ExpressionTypeError`)를 `it.each`로 각각 실행 경로로 지나가며 `cause`의 enumerable own key가 `['code','name','position']` 화이트리스트를 벗어나지 않음을 잠그는 **C2 캐너리** 추가. 프로덕션 코드 변경 없음.
   - `secret-resolver.service.ts` — `preserve-caught-error` disable 사유에 "서버 로그만 남는 것도 아니다"가 판정축(C1)이 아니라 보조 근거임을 명시하는 **주석 4줄 추가뿐**. 로직 변경 없음.
   - `code.handler.spec.ts` — `captureRejected` 헬퍼 추출 + `isolated-vm` 컴파일 예외의 `cause`가 enumerable own 속성을 하나도 갖지 않음을 잠그는 **C2 캐너리** 추가. 프로덕션 코드 변경 없음.
   - `plan/in-progress/deps-peer-gating-and-eslint10.md` — 위 작업 완료 기록 + 이전 리뷰(`11_58_35`) WARNING 조치 내역 기록. 코드 아님.
2. **이전 리뷰 라운드(`review/code/2026/08/29/11_58_35/`) 산출물의 신규 커밋(파일 5~15)** — RESOLUTION/SUMMARY/각 reviewer 리포트/메타데이터. 전부 마크다운·JSON 리포트 텍스트이며 실행되는 코드가 아니다.

즉 이번 diff에서 **런타임 동작을 바꾸는 프로덕션 로직 변경은 0건**이다. 방향성은 기존 에러-래핑 보안 정책(`spec/5-system/3-error-handling.md` §6.3.1, C1 AND C2: "래핑된 message가 원본을 담고, `cause`는 message·name 밖의 민감 정보를 속성으로 갖지 않는다")을 **런타임 단언으로 실제로 강제**하는 회귀 테스트(캐너리) 확장이라 보안 관점에서 순증(net positive)이다.

## 검증한 것 (독립 재현)

- `codebase/packages/expression-engine/src/errors.ts`를 직접 열어 `ExpressionError`/`SyntaxError`/`ReferenceError`/`TypeError`가 전부 `this.name`/`this.code`/`this.position`를 생성자 내 일반 대입으로 설정함을 확인 — 셋 다 own·enumerable 속성이 되므로 `Object.keys(cause).sort()).toEqual(['code','name','position'])` 단언이 실제 구현과 정확히 일치한다.
- `grep`으로 현재 `expression-resolver.service.spec.ts`(라인 191~220)와 `code.handler.spec.ts`(라인 245~260)의 실제 줄 번호가 diff 게이트 번호와 일치함을 확인했다.
- 이전 라운드(`11_58_35`)의 WARNING #1("코드화된 단언이 syntax 한 종류만 지나간다")이 이번 diff의 `it.each` 확장(`ExpressionSyntaxError`/`ExpressionReferenceError`/`ExpressionTypeError` 세 클래스 모두, `cause.name`으로 fixture 판별력까지 단언)으로 실제로 해소됐음을 소스에서 직접 확인 — 세 클래스 전부가 실행 경로로 검증된다.
- 이전 라운드의 두 항목(`secret-resolver.service.ts` "형제 3곳→4곳", enumerable 근거 서술 중복)은 이번 diff에서 조치되지 않았으나, RESOLUTION.md와 plan 문서에 후속 항목으로 명시적으로 등재돼 있고 성격이 문서 카운트/중복 설명이라 보안 결함이 아니다.

## 발견사항

- **[INFO]** C2 캐너리는 "enumerable own key" 축으로 명시적으로 스코프가 한정돼 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` (C2 캐너리 `it.each` 블록, diff 게이트 191~220번 줄) / `codebase/backend/src/nodes/data/code/code.handler.spec.ts` (C2 캐너리 `it()` 블록, diff 게이트 252~260번 줄)
  - 상세: `JSON.stringify`/object spread가 enumerable만 직렬화한다는 근거로 이 축을 골랐다는 설명이 주석에 명시돼 있다. 향후 `cause`에 `Object.defineProperty(..., {enumerable: false})`로 non-enumerable 민감 속성이 추가되면 이 캐너리는 이를 잡지 못하는 사각지대가 남는다. 다만 이는 결함이 아니라 스코프를 정확히 문서화한 설계이고, plan 문서(§2 체크리스트 "`cause` 비노출 불변식의 계측 지점")가 이미 별도 후속 항목(`GlobalExceptionFilter`/공용 직렬화 유틸 대상)으로 추적 중이다.
  - 제안: 조치 불요 — 이미 plan에 추적 중.

- **[INFO]** `SecretResolverService.resolve()`의 `preserve-caught-error` eslint-disable 사유 보강.
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (해당 `catch` 블록 내부 주석, diff 게이트 95~99번 줄)
  - 상세: 로직 변경은 없다. 원본 crypto 에러 상세를 `cause`로 감싸지 않고 `logger.error`(ref + workspaceId만)로만 남기는 기존 설계를 유지하며, 새 주석은 "서버 로그에만 남는 것도 아니다"라는 보조 근거가 판정축(C1)과 혼동되지 않도록 명확히 한다. Activity API를 통한 사용자 노출 방지 근거가 정확하다.
  - 제안: 조치 불요.

- **[INFO]** 이전 리뷰 라운드(`11_58_35`) 산출물 전체(RESOLUTION.md/SUMMARY.md/각 reviewer 리포트/`_retry_state.json`/`meta.json`)가 신규 파일로 커밋됐다.
  - 위치: `review/code/2026/08/29/11_58_35/*`
  - 상세: 전부 마크다운·JSON 텍스트로, 코드 실행·시크릿·인증 관련 내용이 없다. `_retry_state.json`/`meta.json`에 로컬 절대경로(작업자 워크스테이션 사용자 홈 경로)가 포함돼 있으나 시크릿·자격증명이 아니고, 이 저장소의 확립된 관례(리뷰 산출물 전체를 감사 기록으로 커밋)에 부합한다(`CLAUDE.md` §Skill 체계 권한표 갱신과 일치).
  - 제안: 조치 불요.

이번 diff 범위 안에서 신규 인젝션(SQL/커맨드/경로 탐색 등), 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 평문 전송, 민감정보 노출 에러 처리 결함은 발견되지 않았다.

## 요약

이번 변경은 프로덕션 로직을 건드리지 않고(1개 파일의 주석 4줄 추가 제외), 기존 에러-래핑 보안 정책(§6.3.1 C1 AND C2)을 실제로 강제하는 회귀 테스트(C2 캐너리)를 `it.each`로 세 오류 클래스 전부에 확장한 것이 핵심이다. 직접 소스(`errors.ts`)를 열어 화이트리스트 값이 실제 구현과 일치함을 재현했고, 이전 라운드에서 지적됐던 "코드화된 단언이 syntax 한 종류만 커버한다"는 커버리지 갭이 이번 diff에서 실제로 닫혔음을 확인했다. 새로 추가된 인젝션·시크릿 하드코딩·인증 우회·평문 노출 벡터는 없으며, 남은 사각지대(non-enumerable 속성, 형제 카운트 정정)는 이미 plan에 후속 항목으로 명시적으로 추적되고 있어 이번 PR 범위에서 추가 조치가 필요하지 않다.

## 위험도

NONE

---

## 뮤테이션/원복 메모

이번 검토에서는 저장소 파일을 뮤테이션하지 않았다(정적 검토 + `grep`/`Read`를 통한 실제 소스 대조만 수행). `git status --short` 확인 결과 본 세션이 저장소에 남긴 변경 없음.
