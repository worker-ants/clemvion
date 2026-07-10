# Rationale 연속성 검토 — activity-disconnected-banner

대상: `spec/2-navigation/4-integration.md` §4.6 신규 조항 + 구현(`ActivityDisconnectedBanner`) — diff-base `origin/main`.

## 발견사항

- **[WARNING]** 신규 배너가 같은 영역(§2.4)의 확립된 status→tone escalation 원칙을 재사용하지 않음
  - target 위치: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/activity-disconnected-banner.tsx:156-157` (`border-amber-300 bg-amber-50 ... text-amber-900` 고정 tone — `status`(`error`/`expired`/`pending_install`) 값과 무관하게 항상 동일)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` → "Attention 가상 필터값 — Expired ∪ Expiring ∪ Error 를 단일 칩으로 노출" §3 "배너 톤·점프 동작 보강" — `error ≥ 1 일 때 dot 색을 amber 에서 red 로 미세 강조` 를 명시적으로 채택. 이 원칙은 같은 페이지 계열의 두 구현 지점에 이미 코드화되어 있다: (a) `codebase/frontend/src/app/(main)/w/[slug]/integrations/page.tsx:357-368` 의 `ATTENTION_BANNER_TONE` (`error` → red 계열, `warn` → yellow 계열, 중앙화된 tone 매핑), (b) `codebase/frontend/src/app/(main)/w/[slug]/integrations/_shared/status-badge.tsx:29-99` 의 `computeStatus()` — `status==='error'` 는 `tone:'err'`(red-500 dot), `status==='expired'`/`'pending_install'` 은 기본 `tone:'warn'`(yellow-500/blue-400 dot) 으로 명확히 분기.
  - 상세: 신규 `ActivityDisconnectedBanner` 는 `error`/`expired`/`pending_install` 세 상태 전부에 동일한 단일 amber 톤을 적용해, 같은 페이지 상단에 이미 렌더되는 `StatusBadge`(§4.1, `page.tsx:148`, `computeStatus()` 기반 — error 는 red)와 시각적으로 어긋나는 신호를 만든다. 동일 통합의 `status='error'` 인 경우, 헤더는 red 로 "심각"을 알리는데 바로 아래 Activity 탭 배너는 amber 로 "경고" 수준만 표시 — 확립된 "tone = 긴급도" 원칙(`0-overview.md §3.4` Inline Alert 3단계 톤 매핑: info/warning/error)과도 어긋난다. 새 Rationale 항목이나 코드 주석으로 "왜 여기서는 통일된 톤을 쓰는가"를 정당화하지 않았다 — 원칙과의 의도적 이탈인지 단순 누락인지 판별 불가.
  - 제안: (a) `ActivityDisconnectedBanner` 가 `status==='error'` 일 때만 red 톤(`border-red-300 bg-red-50 text-red-900` 등, 기존 `ATTENTION_BANNER_TONE.error`/`computeStatus` 의 `err` 팔레트와 동일 계열)으로 분기하도록 수정해 기존 원칙과 정합시키거나, (b) 통일된 톤을 의도적으로 유지하려면 `spec/2-navigation/4-integration.md ## Rationale` 에 "활동 탭 배너는 헤더 상태 배지와 달리 심각도 구분 없이 단일 안내 톤을 쓴다 — 이유: ..." 형태의 짧은 신규 항목을 추가해 §2.4 배너 톤 원칙과의 의도적 구분을 문서화.

- **[INFO]** `pending_install` 을 배너 트리거 조건에 포함한 결정이 인접 "정상 전환 상태" 원칙과 대비되는데 교차 참조가 없음
  - target 위치: `spec/2-navigation/4-integration.md` §4.6 신규 불릿 (`- **연결 안 됨 배너 (§4.1 status)**: ... status ≠ connected (error / expired / pending_install) ...`)
  - 과거 결정 출처: 같은 문서 `## Rationale` → "`pending_install` 은 필터 칩에 추가하지 않는다" ("사용자가 외부 흐름을 진행 중인 **정상 전환 상태**로 보고 필터 칩에 추가하지 않는다") + 이를 참조하는 `status-badge.tsx:159` `needsAttention()` (`status === 'pending_install' → return false`, "정상 상태" 를 attention 에서 배제하는 원칙의 코드화).
  - 상세: `pending_install` 은 워크스페이스 목록/사이드바 attention 신호에서는 명시적으로 "정상 상태"로 배제되는데, 신규 §4.6 배너는 같은 상태를 amber 경고 배너 트리거 조건에 포함시킨다. 두 결정이 실제로 모순은 아니다 — 배너는 "왜 활동이 기록되지 않는가"를 설명하는 진단 성격이고, 필터 칩/attention 카운트는 "사용자가 지금 조치해야 하는가"를 판정하는 다른 축이며, §4.6 신규 불릿 자체가 그 근거(활동 미기록 이유)를 인라인으로 제공한다. 다만 두 문서 지점이 서로 참조하지 않아, 이후 편집자가 "pending_install 은 attention 대상이 아니다"는 원칙만 보고 §4.6 배너 조건에서 pending_install 을 제외하는 방향으로 되돌릴 위험이 있다.
  - 제안: `spec/2-navigation/4-integration.md ## Rationale` 의 "`pending_install` 은 필터 칩에 추가하지 않는다" 항목 끝에, "활동 탭의 연결 안 됨 배너(§4.6)는 이 원칙과 별개 축 — attention 배제는 '조치 불요', 활동 배너는 '데이터 부재 사유 설명'이라 pending_install 도 포함한다" 는 한 줄 교차 참조를 추가해 두 결정의 공존을 명시.

- **[INFO]** 배경 근거가 `## Rationale` 이 아닌 본문 불릿에 인라인으로 남음
  - target 위치: `spec/2-navigation/4-integration.md` §4.6 신규 불릿 — "이 상태에서는 새 호출이 기록되지 않으므로(AI Agent 는 MCP bridge 가 미연결 통합의 tool 을 노출하지 않아 호출 자체가 없고, 직결 노드는 `INTEGRATION_NOT_CONNECTED` 로 즉시 실패)" 절이 본문에 직접 서술됨
  - 과거 결정 출처: 프로젝트 공통 규약(`CLAUDE.md` "정보 저장 위치") — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`". 같은 문서의 다른 결정들(SMTP `verify()` 채택, Attention 가상 필터값, 자동 갱신 통합 attention 제외 등)은 모두 이 관행대로 본문은 latest-only 사실만, 배경·대안 비교는 `## Rationale` 에 분리 기술한다.
  - 상세: 위반이라기보다 문서 구조 관행과의 미세한 불일치 — 본문에 "왜"가 한 문장 섞여 들어가 있어 향후 대안 비교/재검토가 필요할 때 `## Rationale` 만 보고는 이 결정의 배경을 재구성할 수 없다.
  - 제안: 본문 불릿은 "≠connected 상태면 배너 노출, [개요 탭] 이동 버튼 포함" 정도의 latest-only 서술로 축약하고, MCP bridge/`INTEGRATION_NOT_CONNECTED` 근거는 `## Rationale` 에 신규 항목("활동 탭 연결 안 됨 배너 도입 근거")으로 옮기는 것을 권장. (위 두 INFO 항목과 병합해 한 Rationale 항목으로 작성 가능.)

## 요약

신규 §4.6 "연결 안 됨" 배너는 spec 본문이 명시한 대로 정확히 구현됐고(빈 상태·목록 양쪽에 배너 노출, `connected`(expires-soon 포함)에서는 미노출 — DB status 4값 원칙·가상 필터값 미확장 원칙과 정합), 과거 Rationale 이 명시적으로 기각한 대안을 재도입하거나 시스템 invariant 를 우회하는 지점은 발견되지 않았다. 다만 같은 페이지 계열에 이미 Rationale 로 못박힌 "error 는 red 로 escalate" 톤 원칙을 새 배너가 재사용하지 않고 균일한 amber 로 처리한 점은 원칙과의 근거 없는 이탈로 보여 WARNING 대상이며, `pending_install` 을 배너에 포함한 결정과 "필터 칩 배제(정상 상태)" 원칙 간 교차 참조 부재, 배경 근거의 본문 인라인 배치는 문서 정합·향후 유지보수 관점의 INFO 로 남긴다.

## 위험도

LOW
