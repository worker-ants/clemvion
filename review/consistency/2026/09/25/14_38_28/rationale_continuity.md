# Rationale 연속성 검토 — spec-draft-workspace-path-guard

## 발견사항

- **[WARNING] `@WorkspaceParam` 은 이 저장소가 이미 두 번 재기각한 "라우트별 opt-in 마커" 패턴이다 — 완화책(저장소 가드)이 미상세**
  - target 위치: `plan/in-progress/spec-draft-workspace-path-guard.md` C-1(c) "74번째 라우트 문제는 데코레이터로 안 닫힌다" 문단, D-1·D-4
  - 과거 결정 출처: (1) `spec/data-flow/12-workspace.md` §"멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관" 의 "기각된 대안 — 73개 라우트에 `@Roles('viewer')` 부착"(재발 사유로 기각), (2) `spec/5-system/1-auth.md` §"부트 캐너리 — `@WorkspaceId()` reflection 자가검증" (b) "왜 `SetMetadata`+`Reflector` opt-in 마커로 가지 않았는가 — **재기각이다**"("그 기각을 되돌리지 않는다"), (3) 코드 주석 `codebase/backend/src/common/guards/roles.guard.ts:50-51` "라우트마다 사람이 데코레이터를 기억하는 opt-in 모델은 이미 최소 2회 누락됐다"
  - 상세: target 은 이 정확한 긴장을 스스로 인지하고 인용한다("위 절이 «74번째 라우트에서 재발» 로 기각한 모양") — 그 자체는 좋은 연속성 실천이다. 그런데 제시하는 해법은 여전히 **라우트마다 `@WorkspaceParam('<name>')` 을 붙여야 하는 opt-in 데코레이터**이고, 그 gap 을 닫는다는 "저장소 가드"는 D-4 한 줄 — "컨트롤러 핸들러가 워크스페이스 ID 를 `@Param` 으로 바인딩하지 않는다" — 로만 적혀 있다. 과거 두 rationale 이 opt-in 을 기각한 근거는 정확히 "재발 위험"이었고, 캐너리 해법을 택한 이유는 "호출부에 아무것도 요구하지 않는다"는 성질이었다. 새 저장소 가드가 그 성질(무엇을 어떻게 정적으로 탐지하는지, 오탐/누락 경계, fail-closed 방향)을 문서화하지 않은 채로는 — 이 저장소 컨벤션(`no-restricted-syntax` 커스텀 규칙 등 유사 선례 0건, 2026-09-25 grep)에 그런 정밀 AST 탐지가 실제로 존재한 적이 없다 — 다음 라우트가 평범한 `@Param('id')` 를 다시 쓰는 시나리오를 막는다는 보장이 서술만큼 강하지 않다.
  - 제안: C-1(c)·D-4 에 저장소 가드의 구체 메커니즘(정적 스캔 대상·판별 규칙·실패 방향)을 부트 캐너리와 동등한 밀도로 명시하거나, 최소한 "이 가드가 구현되기 전에는 opt-in 재발 위험이 남는다"는 caveat 을 Rationale 에 명시한다.

- **[WARNING] `13-replay-rerun.md` — 코드 3분기가 §RR-PL-06 본문·회귀 잠금 목록·i18n 서술과 어긋난 채 남는다**
  - target 위치: `plan/in-progress/spec-draft-workspace-path-guard.md` C-8
  - 과거 결정 출처: `spec/5-system/13-replay-rerun.md` §RR-PL-06(라인 123-133) "백엔드도 동일 가드를 enforce 하고 미허가 호출은 `RERUN_PERMISSION_DENIED` 반환", 및 §7 "회귀 잠금"(라인 527) "권한 거부(`RERUN_PERMISSION_DENIED`)"를 단위·통합·e2e 가 지킨다는 서술
  - 상세: target 은 에러 표(라인 241/270)만 3분기(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`RERUN_PERMISSION_DENIED`)로 가르고 "이 표는 지금도 틀려 있다"고 정확히 지적하지만, 같은 문서의 RR-PL-06 본문 문장("동일 가드를 enforce 하고 … `RERUN_PERMISSION_DENIED` 반환")과 §7 "회귀 잠금" 목록("권한 거부(`RERUN_PERMISSION_DENIED`)")은 여전히 "권한 실패 = 단일 코드"라는 이제는 깨지는 invariant 를 그대로 서술한다. 이 두 자리는 target 의 변경 목록(C-1~C-9)에 없다.
  - 제안: C-8 에 RR-PL-06 본문과 §7 회귀 잠금 목록의 문구도 함께 갱신 대상으로 추가한다(예: "권한 거부는 계층별로 `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`RERUN_PERMISSION_DENIED` 셋으로 나뉜다").

- **[INFO] `error-codes.md` 역사적 예외 레지스트리 — 병합 행에서 `forbidden` 만 제거하면 다른 셀이 남는다**
  - target 위치: `plan/in-progress/spec-draft-workspace-path-guard.md` C-4 1번째 불릿
  - 과거 결정 출처: `spec/conventions/error-codes.md` §3 표의 `invitation_not_found · … · forbidden · rate_limited` 병합 행 — "이름이 부정확한 이유" 셀이 "백엔드(`workspace-invitations.service.ts` / `auth.service.ts`)가 `code` 값으로 분기"라 서술하고, "진실(의미)" 셀이 "…/권한 부족/rate-limit"을 포함
  - 상세: target 의 근거(코드는 `admin_required` 를 던지고 `forbidden` 발행처 0건)는 실측으로 확인된다(`workspace-invitations.service.ts:541` `code: 'admin_required'`, frontend `INVITATION_ERROR` 상수에도 `forbidden` 없음) — 정정 자체는 타당하다. 다만 이 행은 6개 코드가 **하나의 공유 셀**(이유·진실·근거)로 묶여 있어, `forbidden` 토큰만 나열에서 빼면 "진실(의미)" 셀의 "권한 부족" 문구와 "이유" 셀의 "백엔드가 … 분기" 서술(이제 `forbidden` 에는 더 이상 사실이 아님)이 그대로 남아 셀 내부 정합이 깨진다.
  - 제안: `forbidden` 제거 시 "진실(의미)" 셀에서 "권한 부족" 문구도 함께 제거(또는 "구 버전에서 권한 부족 — 2026-09-25 이후 `ADMIN_REQUIRED` 로 이관"으로 각주화)하고, "이유" 셀의 "백엔드가 … 분기" 서술이 남은 5개 코드에는 여전히 참임을 확인한다.

- **[INFO] "워크스페이스 `:id` 경로 파라미터" 표 행 — 두 단계 전환이 memberId/invitationId 와 합산된 카운트(18)를 흐린다**
  - target 위치: `plan/in-progress/spec-draft-workspace-path-guard.md` C-1(d)
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` §"`X-Workspace-Id` 헤더 vs `:id` 경로 파라미터" 표 — "워크스페이스 `:id` 경로 파라미터" 행이 `@Param('id')` 14곳과 `memberId`·`invitationId` 4곳을 합쳐 "총 18곳"으로 단일 행에 묶어 서술
  - 상세: target 은 "표의 «워크스페이스 `:id` 경로 파라미터» 행은 두 단계가 된다"고만 적는데, 실제로는 `:id`(워크스페이스, 이제 가드 우선 `isUuidShaped`+`ParseUUIDPipe` 2단)와 `memberId`/`invitationId`(그대로 `ParseUUIDPipe` 1단)가 갈라져야 정확하다 — 원문이 이미 이 둘을 하나의 카운트(18)로 합쳐 놓았기 때문에, 행을 쪼개지 않고 "두 단계가 된다"고만 고치면 memberId/invitationId 까지 2단으로 바뀐 것처럼 읽힐 위험이 있다. 같은 절의 "적용 범위" 문장("헤더 술어는 `@Roles()` 또는 `@WorkspaceId()` 를 쓰는 인증 라우트에서만 돈다")도 `@WorkspaceParam()` 추가를 반영하지 않는다.
  - 제안: 표 행을 "`:id`(워크스페이스, 2단)"와 "`memberId`·`invitationId`(1단, 유지)"로 분리하고, "적용 범위" 문장에 `@WorkspaceParam()` 을 병기한다.

## 요약

target 은 Rationale 연속성 실천 자체는 대체로 모범적이다 — 과거 기각 대안("73개 라우트 `@Roles('viewer')` 부착 — 74번째 라우트 재발")을 명시적으로 인용하고 트래커의 스코프 조건("구조적 해법 우선")을 충족시키며, 가드 거부 코드 무부여 결정(`3-error-handling.md §1.3` 3분기)을 뒤집을 때도 그 결정의 근거("새 경로에만 코드를 붙이면 `@Roles()` 유무로 body 가 갈린다")를 정면으로 받아 **전역 적용**으로 해소하는 등, 과거 결정을 왜곡 없이 계승·확장한다. `forbidden` 히스토리컬 아티팩트 제거도 grep 실측(코드가 실제로 던지는 값은 `admin_required`이며 프론트도 `forbidden` 을 참조하지 않음)에 근거해 정당하다. 다만 (1) 새로 도입하는 `@WorkspaceParam` opt-in 데코레이터가 이 저장소에서 이미 두 번(§"멤버십 검증은 가드 1곳에서", §"부트 캐너리")명시적으로 재기각된 패턴군과 구조적으로 같은 계열인데 그 완화책("저장소 가드")이 과거 캐너리 수준의 상세·엄밀함 없이 한 줄로만 적혀 있고, (2) 코드 3분기 변경이 `13-replay-rerun.md` 안의 다른 서술(§RR-PL-06 본문·회귀 잠금 목록)까지 완전히 전파되지 않았으며, (3) `error-codes.md` 의 병합 행 편집이 셀 단위로 완결되지 않은 점은 spec 반영 전에 보완이 필요하다.

## 위험도
MEDIUM
