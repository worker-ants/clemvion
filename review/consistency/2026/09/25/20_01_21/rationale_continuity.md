# Rationale 연속성 검토 보고서

검토 대상: `spec/2-navigation/9-user-profile.md`(주 target) + `spec/5-system/1-auth.md` · `spec/data-flow/12-workspace.md`(직접 관련 spec, 전문 포함) + 그 외 관련 spec 들의 `## Rationale` 발췌.

## 발견사항

### [WARNING] 경로 파라미터 워크스페이스 가드의 Owner 요구 라우트 수가 같은 Rationale 안에서 2곳 vs 1곳으로 어긋남

- target 위치: `spec/data-flow/12-workspace.md` `## Rationale` → `### 경로 파라미터 워크스페이스도 가드가 본다 (2026-09-25)` 및 바로 아래 `### 가드 거부의 오류 코드 (2026-09-25)`
- 과거 결정 출처: 같은 두 섹션 내부(자기 자신) — 별도 spec 과의 충돌이 아니라 동일 결정을 서술한 세 문장 간의 수치 불일치
- 상세:
  - `### 경로 파라미터 워크스페이스도 가드가 본다`: "역할 요구는 서비스 계층과 같게 `@Roles()` 로 적는다 — **Owner/Admin 요구 8곳**은 `@Roles('admin')`, **Owner 요구 2곳**(`remove` · `transferOwnership`)은 `@Roles('owner')`, 멤버면 되는 곳은 `@Roles()` 없이." → admin 8 + owner 2 = 10.
  - `### 가드 거부의 오류 코드` 안의 "비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER` 다" 문단: "대가는 경로 라우트 중 **Admin/Owner 요구 10곳**에서 비멤버가 받는 코드가 `ADMIN_REQUIRED` · `OWNER_REQUIRED` 에서 `NOT_A_MEMBER` 로 바뀐 것" → 8+2=10 과 정합.
  - 그런데 같은 `### 가드 거부의 오류 코드` 도입부의 실측 각주는 "정정: 결정 당시 main 기준 `editor` 63 · `admin` 9 · `owner` 3 · `viewer` 4, 합 79. **이 변경이 경로 라우트에 `admin` 8 · `owner` 1 을 붙여 합 88.** AST 로 다시 셌다" 라고 적는다 — 여기서는 owner 가 **1**이다. `owner`(3+1=4) 라면 합계는 79+8+1=88 로 산술은 맞지만, 바로 다음 문단·앞 섹션이 명시하는 "owner 요구 2곳(`remove`·`transferOwnership`)"·"Admin/Owner 요구 10곳" 과는 어긋난다(2를 적용하면 79+8+2=89 가 되어야 함).
  - 세 서술이 같은 사건(2026-09-25 경로 파라미터 워크스페이스 가드 도입)을 가리키는데 owner 카운트가 2 / 2 / 1 로 갈린다. "AST 로 다시 셌다" 는 이 저장소가 과거에도 같은 종류의 라우트 카운트를 두 번 이상 틀렸다가 정정한 이력(바로 위 취소선 처리된 `editor 66·admin 9·owner 7·viewer 5` → `63·9·3·4`)이 있는 영역이라, 이번 "88" 도 동일한 유형의 오기일 가능성이 높다.
- 제안: `remove`(워크스페이스 삭제) · `transferOwnership` 중 실제로 몇 건이 새로 `@Roles('owner')` 로 옮겨졌는지 코드(`workspaces.controller.ts`)를 AST 로 재확인해 "합 88" 또는 "owner 요구 2곳/10곳" 중 어느 쪽을 정정할지 확정하고, 세 서술의 숫자를 동일하게 맞춘다. 이 문서 자신이 "구체 수치는 spec 에 박으면 조용히 stale 해진다"(`5-system/1-auth.md` 부트 캐너리 절)는 원칙을 이미 천명하고 있으므로, 같은 원칙을 이 카운트에도 적용해 정확한 수치 하나만 남기거나 "정확한 수는 코드가 SoT" 로 낮추는 것도 대안이다.

## 그 외 확인한 항목 (문제 없음 — 참고용)

아래는 "재도입/번복/원칙 위반"으로 보일 수 있으나 문서 자체가 이미 명시적으로 해소해 두어 문제로 잡지 않은 항목이다.

- `5-system/1-auth.md` §Rationale "부트 캐너리" (b) 가 기각한 "`SetMetadata`+`Reflector` opt-in 마커" 패턴을, `data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다"의 `@WorkspaceParam(...)` 도입이 다시 쓰는 것처럼 보일 수 있다. 그러나 후자는 "이것은 재기각된 opt-in 마커가 아니다" 절에서 "값 바인딩 그 자체라 빠뜨리면 핸들러가 값을 못 받는다"는 구조적 차이를 근거로 명시적으로 구분하고, 빠뜨릴 수 있는 잔여 경로(`@Param`으로 직접 받는 경우)는 별도 저장소 정적 가드(`workspace-param-binding`)로 닫았다고 설명한다 — 기각 사유(누락 재발)를 되돌리지 않는 논증이 갖춰져 있어 CRITICAL 로 보지 않는다.
- `data-flow/12-workspace.md` §Rationale "URL slug = FE 라우팅 SoT"의 "backend 인가 SoT 아님 · header-first 불변" 원칙에 대해, 2026-09-25 경로 파라미터 예외가 "격리 모델과 우선순위는 무번복(token-first 회귀 아님)"이라고 스스로 선을 긋고, `2-navigation/9-user-profile.md` §3 본문도 동일한 예외 문구를 그대로 반영한다 — 원칙 문서와 target 본문이 같은 날짜·같은 근거로 동기화되어 있어 번복이 아니라 명시적 확장으로 판단.
- `5-system/1-auth.md` §2.3.D, §4.1.B 등은 스스로 "이것은 번복이 아니라 구체화" 라고 명시하며 이전 서술과의 관계를 밝히고 있어 무근거 번복에 해당하지 않는다.
- `2-navigation/9-user-profile.md` §5.1 각주(`[^int-email]`)의 취소선 처리된 문장(필드명 동기화 이슈)은 "해소(2026-07-17)"로 종결 처리되어 있고, 취소선으로 원문을 남기는 방식이 이 저장소의 정정 관례(자기-반증형 소정정)와 일치한다.

## 요약

target(`2-navigation/9-user-profile.md`)과 직접 관련된 `5-system/1-auth.md`·`data-flow/12-workspace.md`는 최근 병합된 "경로 파라미터 워크스페이스도 `RolesGuard` 가 본다" 결정(2026-09-25)을 포함해 대부분의 항목에서 과거 Rationale(멤버십 검증 단일 가드, opt-in 마커 재기각, URL slug 계층 분리 등)과 모순 없이 정합하며, 잠재적으로 "기각된 대안 재도입"처럼 보이는 지점들은 문서 스스로 명시적 근거로 구분해 두었다. 다만 새로 추가된 `### 경로 파라미터 워크스페이스도 가드가 본다` / `### 가드 거부의 오류 코드` 두 절 사이에서 "Owner 요구 라우트 수"가 2곳/2곳/1곳으로 갈리는 산술 불일치가 발견되어, 이 저장소가 반복적으로 겪어 온 "라우트 카운트 오기" 패턴이 이번 결정 기록에도 재발했을 가능성이 있다.

## 위험도

LOW
