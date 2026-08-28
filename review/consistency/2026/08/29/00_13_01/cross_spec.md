# Cross-Spec 일관성 검토 — spec-draft-error-cause-criterion

## 검토 범위 및 방법

target(`plan/in-progress/spec-draft-error-cause-criterion.md`)이 제안하는
`spec/5-system/3-error-handling.md` §6.3.1 신설안을 아래와 대조했다:

- 같은 파일 내 §1.3(유효성 검증)·§1.4(실행 에러)·§2.2(실행 에러 형식)·§6.3(민감정보 마스킹 기존 항목)
- `spec/5-system/2-api-convention.md` §5.3(에러 응답, CWE-209 no-echo 정책)
- `spec/conventions/error-codes.md`, `spec/conventions/secret-store.md`, `spec/conventions/node-output.md`
  (번들에는 컨텍스트 예산 초과로 대부분 절단돼 있어 — `feedback_consistency_spec_mode_budget.md` 기지 이슈와
  동일 패턴 — 실제 파일을 직접 읽어 대조했다)
- 코드베이스 실측: `expression-resolver.service.ts:316`, `code.handler.ts:454`,
  `secret-resolver.service.ts`(eslint-disable 주석), `telegram-client.ts:describeFetchError`(유일한
  기존 `.cause` 소비처, 로거 전용 확인)

## 발견사항

- **[WARNING]** §6.3.1 판별 기준이 REST 레이어의 기존 CWE-209 규칙과 스코프 경계 없이 겹친다
  - target 위치: target 문서 `## 제안` 절, 신설 `#### 6.3.1` 원칙 문장 — "`catch` 한 에러를 새
    에러로 감쌀 때, 감싼 `message` 가 원본 `message` 를 이미 포함하면 `{ cause: err }` 를 부착한다"
    (레이어 한정 없이 일반형으로 서술)
  - 충돌 대상: `spec/5-system/2-api-convention.md` §5.3 — "`message`: 사람이 읽을 짧은 설명.
    **내부 구현 원문(라이브러리 예외 메시지·스택·파일 경로 등)을 echo 하지 않는다 — 정보 노출(CWE-209)
    방지.**" (REST 표준 에러 봉투에 대한 **무조건** 금지, cause 부착 여부와 무관)
  - 상세: target 이 든 3개 실측 사례(`expression-resolver.service.ts`·`code.handler.ts`·
    `secret-resolver.service.ts`)는 모두 **노드/엔진 레벨**(pre-flight throw → `Execution.error`/
    `output.error`) 이고, 이 레벨의 message 정책은 `node-output.md §3.2`("message 자체는 영문
    원문 — 로그/디버깅용 SoT")와 `3-error-handling.md §2.2` 실행 에러 예시(`"Node 'AI Agent' failed:
    LLM connection timeout"` — 원본 상세를 이미 message 에 embed)가 이미 확립해 둔, **REST 표준
    봉투(§1.3/§5.3)와는 다른** 공개 정책이다. §5.3 자신도 "세부 정책은 error-handling §1.3(유효성
    검증)" 이라고 명시 위임하며 §1.4/§2.2(실행 에러)에는 위임하지 않는다 — 즉 문서 내부에 이미
    레이어별 분리가 있다. 그런데 target 이 신설하는 §6.3.1 원칙문은 이 레이어 구분을 언급하지 않고
    "catch 한 에러를 새 에러로 감쌀 때" 라는 **전 레이어 일반형**으로 적혀 있다. `preserve-caught-error`
    ESLint 룰은 recommended 설정으로 백엔드 전역(REST 컨트롤러/서비스 포함)에서 발화하므로, 향후
    컨트롤러/서비스 레이어(§1.3·§5.3 이 지배하는 영역)에서 이 룰에 걸린 개발자가 §6.3.1 을 문자
    그대로 따르면 "message 가 원본을 이미 포함하므로 cause 부착" 판단에 앞서 **원본을 message 에
    embed 한 것 자체가 §5.3 위반**이라는 사실을 가릴 위험이 있다 — 즉 §6.3.1 은 "cause 부착 여부"
    만 답하고 "그 message 를 애초에 그렇게 써도 되는가" 는 §5.3 이 이미 다른(더 엄격한) 답을
    갖고 있는데, target 텍스트가 그 경계를 명시하지 않는다.
  - 제안: §6.3.1 원칙문 앞에 적용 범위 한정 문구를 추가한다 — 예: "본 기준은 message 내용 자체의
    노출 적법성을 판정하지 않는다. REST 표준 에러 봉투(§1.3/§5.3 이 지배)는 내부 예외 원문을
    message 에 embed 하는 것 자체가 이미 금지되어 있으므로 그 경로에서는 이 기준 적용 이전에
    §5.3 위반 여부를 먼저 확인한다. 본 기준이 새로 다루는 대상은 §1.4/§2.2 실행·노드 레벨처럼
    message 원문 embed 가 이미 정책적으로 허용된 경로에서의 `cause` 부착 여부다." 정도로 스코프를
    명시하면 §5.3 과의 겹침이 해소된다.

- **[INFO]** `secret-resolver.service.ts` 의 비부착 근거를 `secret-store.md` SS-SE-05 로 직접 교차 인용 권장
  - target 위치: target 문서 `### 왜 이 기준이 필요한가` 절, Rationale 초안
  - 충돌 대상 아님 — 보강 제안. `spec/conventions/secret-store.md` SS-SE-05("DB row 단위 audit
    log 는 v1 미지원 — application logger 가 `resolve` 실패 시 ref + workspaceId 만 기록(plaintext
    미기록)")가 정확히 target 이 예로 든 "감싼 message 가 원문을 일부러 감춘다" 사례의 기존 SoT다.
    실제로 `secret-resolver.service.ts` 의 `eslint-disable-next-line` 주석도 이미 `SS-SE-05`·`#814`
    를 명시 인용하고 있어 target 의 실측과 정합한다.
  - 상세: 현재 target 초안의 Rationale 은 `#814` 만 인용하고 `SS-SE-05` 를 직접 걸지 않는다.
  - 제안: §6.3.1 비부착 규칙 옆에 `secret-store.md#SS-SE-05` 참조를 추가하면, "왜 이 특정 사례가
    비부착인가"의 근거가 `3-error-handling.md`(신규) ↔ `secret-store.md`(기존) 양쪽에서 대칭적으로
    추적 가능해진다.

## 데이터 모델 / API 계약 / 요구사항 ID / 상태 전이 / RBAC / 계층 책임 — 개별 점검 결과

- **데이터 모델**: target 은 신규 엔티티·필드를 정의하지 않는다. 영향 없음.
- **API 계약**: target 은 `.cause`(JS Error 내부 속성)의 부착 여부만 다루며, 어떤 다운스트림도
  이를 직렬화하지 않음을 실측(`http-exception.filter.ts` 등, 0곳)했고 본 검토도 동일하게 확인했다.
  기존 유일한 `.cause` 소비처(`telegram-client.ts describeFetchError`)는 logger 전용이며 REST/노드
  출력 어디로도 흘러가지 않는다 — API 응답 shape 충돌 없음.
- **요구사항 ID 충돌**: target 은 신규 요구사항 ID를 부여하지 않는다(§6.3.1 은 섹션 번호이지 REQ-ID
  아님). 다른 spec 이 `3-error-handling.md#6.3` 앵커를 참조하는 곳도 없어(grep 0건) 번호 신설로 인한
  앵커 breakage 없음.
- **상태 전이**: 해당 없음.
- **RBAC**: 해당 없음.
- **계층 책임**: `spec/conventions/error-codes.md`(코드 명명 규율)·`secret-store.md`(secret 저장
  추상화) 둘 다 스스로의 Overview 에서 "책임 경계"를 명시하며, 어느 쪽도 "에러 wrapping 시 cause
  부착 정책"을 자기 소유로 선언하지 않는다 — target 이 `3-error-handling.md §6`(로깅/마스킹) 산하에
  배치한 결정은 기존 계층 책임 분할과 **정합**한다(오히려 target 의 "왜 conventions/ 가 아니라
  여기인가" 절의 결론을 직접 뒷받침하는 증거를 이번 검토가 추가로 확인한 셈이다).

## 요약

target 이 인용한 실측(3개 위치·`.cause` 다운스트림 소비 0건)과 배치 결정(`3-error-handling.md §6.3`
신설, `conventions/` 배제)은 실제 코드·기존 spec 과 대조했을 때 정확하며, `secret-store.md`·
`error-codes.md` 의 기존 책임 경계 선언과도 충돌하지 않는다 — 오히려 그 선언들이 target 의 배치
논리를 뒷받침한다. 다만 신설 원칙문이 레이어(노드/엔진 레벨 vs REST 표준 봉투)를 명시하지 않아,
`2-api-convention.md §5.3` 의 무조건적 CWE-209 no-echo 정책과 스코프가 겹치는 지점이 있다 —
`preserve-caught-error` 룰이 백엔드 전역에서 발화하므로 향후 REST 컨트롤러/서비스 레이어에도 이
기준이 그대로 적용될 수 있어, 스코프 한정 문구 추가가 필요하다(WARNING 1건). 이 외 데이터 모델·
API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 관점에서는 다른 spec 영역과의 직접 모순을 발견하지
못했다.

## 위험도

LOW
