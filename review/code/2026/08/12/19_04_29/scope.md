# 변경 범위(Scope) Review — `19_04_29`

## 검토 방법

`git diff origin/main...HEAD --stat` 로 실제 누적 diff(9개 커밋, `779a6e240`~`6298d6fdb`)를
직접 확인하고, 핵심 3개 코드 파일(`idempotency.interceptor.ts`/`.spec.ts`/
`external-interaction.e2e-spec.ts`)과 `plan/**` 2개 파일, `spec/data-flow/15-external-interaction.md`
의 실제 `git diff`/`git show`를 소스에서 직접 열어 프롬프트 서술과 대조했다(프롬프트가 크기 제한으로
핵심 3개 코드 파일의 diff 자체를 생략했기 때문). 선행 8개 리뷰 라운드(`16_29_45`~`18_52_47`)의
scope reviewer 결론(전부 NONE)도 참고했으나 결론을 그대로 수용하지 않고 독립적으로 재확인했다.

## 변경 의도

Spec EIA §R8("idempotency 캐시 대상은 `2xx`·`409`·`410` 의 닫힌 목록, `400 VALIDATION_ERROR`
만 예외")과 어긋나던 선재 결함 — 캐시 제외 조건이 `statusCode >= 400` 이라 `409`·`410` 까지
캐시에서 함께 빠지던 것을 닫힌 목록으로 정정. 1차 조건식 교체가 `409`/`410` 이 서비스에서
`ConflictException`/`GoneException` 으로 **throw** 되어 RxJS error 채널로 흐른다는 사실을
못 봐 도달 불가능한 dead code 였다는 CRITICAL 이 자체 리뷰(`16_29_45`)에서 나왔고,
`catchError` 기반 재설계로 해소한 뒤 5개 라운드에 걸쳐 "고친 자리 옆 형제 자리 누락"류
WARNING(400 만 옛 mock 잔존 · 5xx 가드 우회 · 410 replay 누락 · 직렬화 방어 미검증 ·
e2e 410 부재 · 테스트 ID 충돌 · docstring 과장)을 순차 조치한 전체 이력이 이번 diff 에 누적돼 있다.

## 발견사항

### 검토한 항목 (문제 없음)

- **`idempotency.interceptor.ts` 핵심 변경** (`git diff` 직접 확인): `HttpException`/`throwError`
  import 추가 → 캐시 히트 시 `409`/`410` 을 `HttpException` 재throw 로 재현하는 블록 →
  `cacheTapped()` 를 `tap({next})` 단일 경로에서 `tap({next}) + catchError` 파이프라인으로
  재설계 → 공유 적재 로직을 `storeEntry()` 프라이빗 메서드로 추출(직렬화 실패를 삼켜 원 예외
  보존) → `isErrorStatusCacheable()` named 함수 신설. 전부 "§R8 캐시 대상이 dead code 였다"는
  단일 결함을 실제로 도달 가능한 경로 위에서 고치는 데 필요한 최소 구조 변경이며, 무관한
  개선성 리팩토링이 섞여 있지 않다. 함께 갱신된 JSDoc(인터페이스 필드 주석·`cacheTapped`
  docstring·`isErrorStatusCacheable` docstring)도 방금 바뀐 로직 설명으로 1:1 대응한다.
- **`idempotency.interceptor.spec.ts`**: `makeThrowingHandler()` 헬퍼 신설 + 409/410/5xx/404/
  400/3xx/non-HttpException 케이스가 전부 같은 계약(§R8 닫힌 목록 + error 채널 재현)을
  검증한다. 마지막 커밋(`6298d6fdb`)은 모듈 docstring 문구를 사실에 맞게 좁히는 8줄짜리 순수
  주석 수정뿐(직접 `git show` 로 확인 — 로직 변경 없음). 무관한 describe 블록은 diff 밖.
- **`external-interaction.e2e-spec.ts`**: `IDEM-1`/`IDEM-2`/`IDEM-3` 3건 신설. 기존 테스트 ID
  와 충돌 여부를 직접 grep 으로 재확인한 결과 중복 없음(`18_07_36` 라운드가 지적한 `I-2` 충돌은
  이후 `IDEM-` 접두어로 교체되어 실제로 해소돼 있다). 기존 테스트(`A`~`J`, `G-2` 등)는 무변경.
- **`CHANGELOG.md`**: 단일 hunk — 파일 맨 위에 이번 fix 경위(1차 시도 실패 → 재설계, 클라이언트
  영향, `requestId` 재현 예외)를 설명하는 절 하나만 삽입. 기존 방대한 본문은 diff 밖.
- **`plan/in-progress/backend-lint-gate-broken-on-main.md`**: 이번 작업이 처분한 백로그
  항목들의 체크박스 전환(`[ ]`→`[x]`)과 완료 근거(뮤테이션 실측 표, 1~4차 실패 경위) 인용,
  신규 후속 항목(`readKey`/`hashBody` 경계값 테스트 부재, `responseJson` 내부 손상 무방비) 등재
  뿐 — `developer` 의 `plan/**` 쓰기 권한 범위 내 정상 추적 갱신이다.
- **`plan/in-progress/spec-draft-eia-r8-alignment.md`**: 이전 라운드(`18_27_29` consistency
  plan_coherence WARNING)가 지적한 "developer 가 §2.2 caveat 을 코드 수정과 원자적으로
  지운 사실이 담당 planner plan 에 기록되지 않았다"를 그대로 해소하는 9줄 추가뿐이다.
  planner 소유 plan 을 developer 가 건드리는 것 자체는 CLAUDE.md 표(`developer`: `plan/**`
  쓰기 권한)상 허용 범위이고, 내용도 "planner 사후 확인"용 사실 기록으로 국한된다.
- **`spec/data-flow/15-external-interaction.md`**: 표 한 행에서 이미 해소된 "⚠️ 현행 구현 갭"
  caveat 문구만 삭제(`git diff` 로 정확히 1줄 교체임을 확인). `developer` 의 `spec/` read-only
  원칙과 문자상 경계에 있는 편집이지만, (1) 커밋 메시지가 그 경계를 스스로 인지하고 "서술 문장이
  구현과 원자적으로 안 지워지면 spec 이 거짓이 된다"는 근거를 명시했고, (2) 동일 패턴이 직전
  커밋(`779a6e240`)에서 이미 한 번 선례화됐으며, (3) consistency checker(`18_27_29`)가 "내용은
  §R8 SoT 와 정합·이번 PR 을 막을 필요 없음"으로 확인했고, (4) 그 WARNING 자체가 바로 위 plan
  파일 갱신으로 이번 diff 안에서 닫혔다. 새로운 제품 결정이 아니라 narrow 한 기계적 동기화다.
- **`review/code/2026/08/12/{16_29_45,16_53_26,17_07_45,18_07_36,18_37_45,18_52_47}/**` +
  `review/consistency/2026/08/12/18_27_29/**`**: `developer` 가 직접 작성한 것이 아니라 이번
  fix 를 대상으로 실행된 `code-review-agents`/`consistency-checker` 스킬(및 그 sub-agent)의
  실제 산출물이 각 라운드 fix 커밋에 함께 커밋된 것 — CLAUDE.md 의 "구현 완료 후 자동
  review/fix 는 상시 승인된 강제 의무" 규약과 `review/**` 저장 관행에 정확히 부합하는 표준
  워크플로 산출물이다. 이번 diff 가 크게 부풀어 보이는 주된 이유(83개 파일 중 74개)가 이
  아티팩트들이지만, 전부 같은 §R8 fix 를 다룬 동일 세션의 증적이며 무관한 별도 작업이 아니다.

### 포맷팅 · 임포트 · 설정

- import 변경은 `HttpException`(nestjs/common), `throwError`(rxjs), 테스트 쪽
  `BadRequestException`/`GoneException`/`NotFoundException`/`InternalServerErrorException`
  뿐 — 전부 재설계에 직접 필요한 심볼이고 미사용 임포트나 드라이브바이 정리는 없다.
- 순수 포맷팅-only 변경 없음. `.env.example`/`package.json`/lint config/CI 워크플로 등 설정
  파일 변경은 diffstat 상 전무.

## 요약

83개 파일(핵심 코드/테스트 3, CHANGELOG 1, plan 추적 2, spec SoT 1, 리뷰 인프라 산출물 74·
`review/consistency` 8개 포함) 전부가 "idempotency 캐시가 Spec EIA §R8 의 닫힌 목록
(2xx/409/410)과 어긋나던 선재 결함을, dead code 재설계까지 포함해 완전히 고친다"는 단일 의도로
수렴한다. 핵심 코드(`idempotency.interceptor.ts`)를 직접 `git diff` 로 재확인한 결과 프롬프트
서술과 정확히 일치했고, 그 변경은 이 재설계가 요구하는 최소 구조(judgment 함수 추출·
`catchError` 확장·공유 적재 메서드)를 벗어나지 않는다. `spec/data-flow/15` 캐비트 삭제는
`developer` 의 read-only 경계에 있는 유일한 항목이지만 이미 여러 라운드가 검증한 narrow
exception 의 반복 적용이고, 이번 diff 안에서 그 절차적 갭(plan 미기록)도 스스로 닫았다. 무관한
리팩토링·기능 확장(over-engineering)·드라이브바이 파일 수정·의미 없는 포맷팅·불필요한 주석/
임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE
