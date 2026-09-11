# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 3건 발견 (감사 로그/에러 응답 details 범주 오분류, 결정 라벨 네임스페이스 충돌, `details[].code` 신규 규칙과 §5.4.1.2 "확정 설계" 문장의 정면 충돌)

## 전체 위험도
**CRITICAL** — draft 의 핵심 실측(§(a) 표)에 범주 오류와 집계 누락이 있고, 그 실측 위에 세운 신규 결정(D-1/D-4)이 같은 파일 안에서 어제 막 확정된 "확정 설계" 서술과 문면으로 정면 충돌한다. 5개 checker 중 4개(cross_spec·rationale_continuity·convention_compliance·plan_coherence)가 이 구조적 충돌을 WARNING 으로, naming_collision 이 CRITICAL 로 각기 다른 각도에서 독립 지적했다 — 하향 금지 원칙에 따라 최고 등급(CRITICAL)으로 통합한다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | (a) 실측 표가 **에러 응답 `details`**(`2-api-convention.md §5.3`)와 **감사 로그 `details`**(`audit-actions.md`, `AuditLogsService.record`)를 혼동해 `workspaces.service.ts` 의 감사 로그 기록 2곳(`name`·`settings`, 정상 완료 경로)을 규약 위반으로 오분류 | `## (a)` 실측 표 — `workspaces.service.ts \| name·settings \| 없음 (2곳)` 행 | `codebase/backend/.../workspaces.service.ts:356,428`(감사 로그, 자유형 `details`) vs `2-api-convention.md §5.3`(에러 봉투 전용 형식) | 해당 행을 표에서 제거하거나 "감사 로그 — 본 규약 적용 대상 아님"으로 재분류. 결정문(D-1)에 "감사 로그 `details` 는 §5.3 적용 범위 밖" 한 줄 명시 |
| 2 | naming_collision | 결정 라벨 `D-1`/`D-2`(신규: code 필수화/swagger 명명)가 **같은 파일** `15-chat-channel.md` 안에서 이미 R-CC-21 하위 결정으로 확립돼 코드베이스 10여 곳(`triggers.service.ts`·`*.dto.ts`·`*.spec.ts`)에 인용되는 `D-1`(필드 미수신)/`D-2`(경로 비밀 미사용)와 이름이 충돌 | draft `## 결정` 절 D-1~D-4 | `spec/5-system/15-chat-channel.md:797-798` (R-CC-21 의 `D-1`/`D-2`) + `grep "R-CC-21 / D-"` 10여 곳 | 결정 라벨을 별도 네임스페이스로 변경(예: 변경안 코드 A1/B1/C1/D1 재사용, 또는 `CV-1..CV-4`). spec 본문 흡수 시 `R-CC-21 / D-1` 표기와 절대 겹치지 않게 |
| 3 | naming_collision (cross_spec·rationale_continuity·convention_compliance·plan_coherence 는 WARNING 으로 동일 이슈 지적 — 최고 등급 채택) | D-1("details 객체는 `code` 를 생략하지 않는다")과 D-4(`§5.4.1` 표만 갱신)가, 같은 파일 `§5.4.1.2` 가 **어제(f947b49f4) 막 "확정 설계"로 못박은** 문장 — *"`details[].code` 는 두 항목(`chatChannel`·`provider`) 모두 서비스 가드 갈래라 싣지 않는다"* — 와 정면 모순. `§5.4.1.1`(rotation 표, 동일 서술)도 D-4 스코프 밖. 실측 인벤토리도 `triggers.service.ts` 실제 사이트(13곳, `botToken`·`chatChannel`·`provider` 등 누락)를 9곳으로 과소 집계 | `## 결정` D-1·D-4, `## 변경안` D1 (`§5.4.1` 3축 표만 지목) | `spec/5-system/15-chat-channel.md` §5.4.1.2 "확정 설계" 문단 + §5.4.1.1 rotation 표(스코프 밖으로 방치) | D-4 범위를 §5.4.1.2(및 §5.4.1.1)까지 확장해 동일 톤("계약값 `INVALID_FIELD`, 배선 대기")으로 동반 갱신하거나, `chatChannel`/`provider` 두 사이트를 D-1 규칙의 **의도적 예외**로 명문화. (a) 실측 표를 `triggers.service.ts` 13곳(+ workspaces 오분류 제외) 기준으로 재작성 |

## planner 인계 (권한 밖 Critical)

> 해당 없음 — target(`plan/in-progress/spec-draft-chat-channel-conventions.md`)은 `spec/` 에 아직
> 쓰이지 않은 **planner 자신의 draft**이며(`project-planner` 가 `spec/` 쓰기 직전 수행하는
> `consistency-check --spec` 통상 절차), 지적된 3건 Critical 은 모두 이 draft 문서 자체와
> planner 소유 파일(`plan/in-progress/**`, `spec/**`) 안에서 발생한다. developer 권한 밖 spec
> drift 유형이 아니므로 인계 대상이 없다 — 호출자(project-planner)가 직접 draft 를 정정한 뒤
> 재검토하면 된다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | — | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `spec_impact` 목록에 없는 미러 문서 — `2-trigger-list.md` 가 `details.field` 서술을 재인용/재서술 | frontmatter `spec_impact` (4개 파일만 나열) | `spec/2-navigation/2-trigger-list.md` §3 (L176~179, L336) | `spec_impact` 에 추가하거나 D-4 적용 후 이 문서 staleness 점검 체크리스트 항목 명시 |
| 2 | plan_coherence | 체크리스트 "트래커: `:2130`·`:2235`" 항목이 파일명을 밝히지 않음 (줄 번호만) | `## 체크리스트` 4번째 항목 | `plan/in-progress/spec-draft-nullable-notation-followups.md` (계속 자라는 파일, 현재 2,600줄대) | 파일명 + 인용문(*"setupChannel '멱등 = yes' … 각주가 필요하다"*)을 줄 번호와 함께/대신 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 신설 명명 규칙(B1)이 `swagger.md §5-4` "새 엔드포인트 체크리스트"에는 반영 안 됨 | `swagger.md §5-4` | 체크리스트에 "요청 DTO 명명 — Update 접두 범위 확인" 한 줄 추가 고려 |
| 2 | convention_compliance | D-2(swagger.md 명명 규칙) 삽입 위치가 기존 `§1-4~§1-6` 번호 하위섹션 + Rationale 역링크 관행과 형식 불명확 | `## 변경안` B1 (`swagger.md §1`) | `1-7. DTO/Update 접두 명명` 같은 번호 있는 소절 + `## Rationale` 대응 절 신설 |
| 3 | rationale_continuity | `§5.4.1` 실측 콜아웃 셀을 "계약값"으로 교체하면 실측/계약의 인식론적 지위가 이웃 셀과 달라짐 | D-4, `## 변경안` D1 | "실측: code 없음" 문구를 지우지 말고 "계약(D-1, 배선 대기)"을 별도 문장으로 병기 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | D-1 신규 규칙과 §5.4.1.2 확정 서술 충돌(WARNING) · `2-trigger-list.md` spec_impact 누락 |
| rationale_continuity | MEDIUM | 같은 D-1/§5.4.1.2 충돌(WARNING, 실측 범위 누락 포함) · 결정 라벨 `D-1~D-4` 가 R-CC-21 기존 라벨과 충돌(WARNING) |
| convention_compliance | MEDIUM (개별 CRITICAL 1건 포함) | (a) 실측이 감사 로그 `details` 를 에러 응답 위반으로 오분류(**CRITICAL**) · `triggers.service.ts` 집계 누락(WARNING) · §5.4.1/§5.4.1.2 상충 방치(WARNING) |
| plan_coherence | LOW | D-4 가 `§5.4.1` 만 겨눠 `§5.4.1.1`·`§5.4.1.2` 동반 갱신 누락(WARNING) · 체크리스트 파일명 누락(INFO) |
| naming_collision | CRITICAL | 결정 라벨 `D-1`/`D-2` 가 R-CC-21 기존 라벨과 정면 충돌 · D-1 규칙이 §5.4.1.2 "확정 설계" 문장과 모순 + 실측 인벤토리 과소 집계(둘 다 **CRITICAL**) |

## 권장 조치사항
1. **(BLOCK 해소 최우선)** (a) 실측 표에서 `workspaces.service.ts`(감사 로그) 행을 제거/재분류하고, D-1 결정문에 "감사 로그 `details` 는 §5.3 적용 범위 밖" 명시.
2. **(BLOCK 해소)** draft `## 결정` 절의 `D-1`~`D-4` 라벨을 R-CC-21 의 기존 `D-1`/`D-2` 와 겹치지 않는 별도 네임스페이스로 변경(예: 변경안 코드 A1/B1/C1/D1 재사용).
3. **(BLOCK 해소)** D-4 스코프를 `§5.4.1.2`(및 `§5.4.1.1`)까지 넓혀 "확정 설계" 문장을 D-1 신규 규칙에 맞춰 동반 정정하거나, `chatChannel`/`provider` 두 사이트를 명시적 예외로 결정문에 적는다. (a)/D-1 실측 표를 `triggers.service.ts` 13곳 기준으로 재작성.
4. `spec_impact` 에 `spec/2-navigation/2-trigger-list.md` 추가(또는 staleness 점검 항목 명시).
5. 체크리스트 트래커 참조에 파일명(`spec-draft-nullable-notation-followups.md`) 명시.
6. (선택) swagger.md 신설 규칙을 번호 하위섹션(`1-7`) + Rationale 역링크 형식으로, `§5.4.1` 실측/계약 셀은 병기 방식으로 편집.
