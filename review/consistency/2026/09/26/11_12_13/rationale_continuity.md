# Rationale 연속성 검토 — `plan/in-progress/spec-draft-swagger-forbidden-codes.md`

## 발견사항

- **[WARNING]** reflection 가드에 "0/모집단 붕괴" 캐너리가 빠져 있다
  - target 위치: target 문서 `## 변경 (1)` (frontmatter `code:` 추가) 및 `## 변경 (3)` "reflection 으로 센다" 단락.
    구체 구현은 `plan/in-progress/forbidden-desc-codes.md` §방향 "저장소 가드 `forbidden-response-codes-guard.ts` — reflection"
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` §Rationale "멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관 (2026-08-08)"의
    "**reflection 파손은 부트에서 막는다**" 단락 — `handlerConsumesWorkspaceId` 가 Nest 비공개 API(`ROUTE_ARGS_METADATA`)에 의존해
    파손 방향이 **fail-open** 이므로, "부팅 시 소비 라우트 수가 0 이면 throw 하는 캐너리"(`assertWorkspaceIdReflectionWorks`)를 명시적으로
    두었다는 원칙. 같은 저장소의 직계 자매 가드 `http-status-advertised.spec.ts`(2026-09-26, 같은 커밋 계열 — `dde7c3013`)도 같은
    원칙을 그대로 옮겨 `expect(controllerFiles.length).toBeGreaterThan(30)` · `expect(handlerCount...).toBeGreaterThan(150)` 로
    "reflection 스캔이 조용히 빈 집합을 돌려주는" 실패 모드를 막고 있다.
  - 상세: target·구현 plan 모두 `forbidden-response-codes` 가드의 **위반 수 베이스라인(0)** 은 정의했지만, "가드가 스캔하는
    라우트 전체 모집단이 예상보다 급감(예: import 경로 변경·Nest 메타데이터 키 이름 변경으로 컨트롤러를 하나도 못 읽음)했을 때"의
    안전장치는 언급이 없다. `RolesGuard` 와 같은 규칙(`@Public()` · `@Roles()` · 워크스페이스 소비 reflection)을 그대로 재사용한다고
    스스로 적었으므로, 그 규칙이 기대는 것과 똑같은 Nest 비공개 API 의존성·똑같은 fail-open 성격을 물려받는다 — 그런데 이 저장소가
    바로 그 자리에서 이미 한 번 "부팅 캐너리로 막는다"는 결정을 내렸고, 하루 전 커밋의 자매 가드가 그 결정을 "모집단 하한 assertion"
    형태로 재확인했다. 이 draft/plan 은 그 두 선례 중 어느 쪽도 인용하거나 재검토하지 않는다.
  - 제안: 구현 단계(`forbidden-response-codes.spec.ts`)에서 스캔된 컨트롤러 수·핸들러 수에 대해 `http-status-advertised.spec.ts` 와
    같은 형태의 최소값 assertion(예: 컨트롤러 파일 수 > 30, 403 가능 라우트 수 > 150)을 넣거나, 넣지 않기로 한다면 target 의
    `## Rationale`(변경 (3))에 "왜 이 가드는 population 캐너리가 필요 없는가"를 명시적으로 적어 위 두 선례와의 차이를 밝힐 것.

- **[INFO]** §5-4 제목("새 엔드포인트 체크리스트")과 소급 강제 범위의 불일치를 새 Rationale이 직접 해소하지 않는다
  - target 위치: target 문서 서두 "**왜 가드인가**" 단락, `## 변경 (3)` 신설 Rationale 전체
  - 과거 결정 출처: `spec/conventions/swagger.md` 자신의 반복된 원칙 — §1-4 "적용 범위 — 신규 변경 한정: … 본 절의 가치는
    '이미 있는 것의 정리'가 아니라 '앞으로의 불투명 누적 방지'다", §1-7 "기존 DTO 는 소급 정리 대상이 아니다", §3 JSDoc
    "기존 DTO 는 소급 정리 대상이 아니다 — §1-4 신설 때와 같은 원칙이다. 그 자리를 다음에 건드릴 때 함께 맞춘다."
  - 상세: target 은 "§5-4 는 «새 엔드포인트» 체크리스트라 기존 라우트가 따라가지 않았다"는 사실을 **문제**로 서술하고, 그 문제를
    풀기 위해 129곳을 즉시 소급 수정 + 전 라우트 강제 가드로 닫는다. 이는 위 세 항목이 명시한 "신규 변경 한정, 소급 정리 대상 아님"
    원칙과 방향이 반대다. 다만 이 저장소에는 바로 하루 전 같은 파일에 정확히 같은 모양의 선례가 있다 — §2-4 "광고한 성공 코드 ↔
    실제 성공 코드"(2026-09-26) 역시 기존 223개 핸들러 전수를 소급 대조해 15곳을 고치고 전역 강제 가드(`http-status-advertised`)를
    붙였다. 즉 이 저장소는 "스타일/형태 규칙은 소급 안 함, 계약-정확성 규칙(광고와 실제가 다르면 버그)은 소급 강제함"이라는 **두
    갈래**를 이미 실무로 구분해 온 것으로 읽히지만, 그 구분을 명문화한 Rationale 문장은 아직 없다 — target 도 §2-4 선례를
    인용하지 않는다.
  - 제안: target `## 변경 (3)` Rationale 에 "왜 이 결정은 §1-4/§1-7/§3 의 '신규 한정' 원칙이 아니라 §2-4 의 '계약-정확성은 소급'
    선례를 따르는가"를 한 문장으로 명시하면, 다음 검토자가 "새 엔드포인트 체크리스트인데 왜 기존 129곳을 소급 강제하나"를 §1-4/§1-7
    위반으로 오독하는 것을 막을 수 있다(swagger.md 자신이 §1-4 각주에서 이미 이런 오독 방지 문구를 반복 사용해 온 패턴과 동형).

## 확인된 정합 사항 (참고)

- target 의 핵심 채택("`@Roles()` 라우트도 `NOT_A_MEMBER` 를 함께 싣는다")은 `spec/data-flow/12-workspace.md` §Rationale
  "가드 거부의 오류 코드 (2026-09-25)"가 이미 확정한 채택안 (나)("비멤버는 항상 `NOT_A_MEMBER`, 멤버의 역할 미달만 역할 코드")를
  정확히 미러링하며, 그 절이 기각한 (가)("라우트 요구의 코드")를 재도입하지 않는다.
  `viewer` 코드 단일화·"서비스 거부는 세지 않는다"·"가드는 가드 코드만 본다"도 같은 절·같은 문서의 기존 결정과 일치한다.
- target `## Rationale (이 draft 의)`가 적은 "기각한 대안 — `@Roles()` 자동 데코레이터"는 "이 draft 를 쓰며 검토했다"고 정직하게
  귀속돼 있어(소급 이력 날조 아님), memory 의 "Rationale «기각된 대안» 은 실제 이력 필수" 기준에 어긋나지 않는다.
- 결정 번복(§5-4 문구 변경)에 대해 target 이 `## 변경 (3)`에 상세한 새 Rationale(실측 129/157·28, 문구별 근거, 기각 경위)을
  함께 작성해 두어, 등급 기준 3("결정의 무근거 번복")에 해당하는 문제는 없다.
- 컨텍스트 예산으로 `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 의 Rationale 이 번들에서 절단돼
  있었다(project 기존 이슈, `feedback_consistency_spec_mode_budget.md` 와 동일 패턴). 본 검토는 세 파일을 `Read` 로 직접
  열어 보완했고 추가 충돌은 발견하지 못했다.

## 요약

target 이 실제로 의존하는 단일 결정 — `spec/data-flow/12-workspace.md` §"가드 거부의 오류 코드"의 채택안 (나) — 과의 정합은
정확하고, 새 Rationale 도 충실히 작성돼 등급 기준상 CRITICAL 에 해당하는 "기각된 대안 재도입"이나 "무근거 번복"은 없다. 다만
(1) 같은 계열의 reflection 가드(자매 가드 `http-status-advertised`, 그리고 그 원류인 `12-workspace.md`의 부트 캐너리 원칙)가
이미 확립한 "population 붕괴 방지" 안전장치를 이번 가드 설계가 언급 없이 건너뛰었고, (2) §5-4 를 "새 엔드포인트 체크리스트"에서
사실상 "전 라우트 강제"로 넓히는 것이 swagger.md 자신의 "신규 변경 한정" 원칙과 표면적으로 어긋나 보이는데 그 구분을 해소하는
문장이 없다. 둘 다 구현/문서 완성 전에 한두 문장으로 닫을 수 있는 수준이다.

## 위험도

LOW
