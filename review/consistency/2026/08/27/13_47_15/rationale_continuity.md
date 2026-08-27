# Rationale 연속성 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 방법 메모

프롬프트의 diff 섹션(`## 구현 변경 사항`)이 컨텍스트 예산으로 생략되어 있어, 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/masking-residuals-0b195b`)에서 직접
`git diff origin/main...HEAD`(전체 87개 파일, spec/5-system/ 3개)를 재확인했다. 이 브랜치는
직전 두 라운드의 rationale-continuity 검토(`19_26_06` CRITICAL 발견 → `57fb83592`로 해소,
`13_25_45` NONE 판정 → 그 직후 자체 impl-done이 새 BLOCK:YES를 내 `6af73b2c8`로 해소)를 거친
상태이므로, 이번 라운드는 **그 마지막 propagation 커밋(`6af73b2c8`)이 실제로 완결됐는지**와
**spec/5-system/ 전체 diff가 과거 Rationale과 충돌하지 않는지**를 함께 검증했다.

## 검토 대상 (spec/5-system/, origin/main 대비 실질 변경 3파일)

- `spec/5-system/4-execution-engine.md` — `_resumeState`/`_retryState`/`_resumeCheckpoint`의
  credential 제거 메커니즘 서술을 "`maskSensitiveFields` boundary"에서 "allow-list"로 정정
  + `Engine Raw Config Exposure` 절에 "config에는 storage-time 마스킹이 없다" 블록 신설
  (13_25_45에서 이미 NONE 판정, 이번 라운드에서 재확인 — 변경 없음).
- `spec/5-system/14-external-interaction-api.md` — §R17 축자 인용의 `boundary masking parity`
  → `egress masking parity` 명칭 동기화 (신규, `6af73b2c8`).
- `spec/5-system/6-websocket-protocol.md` — §4.1이 원용하는 같은 원칙명 동기화 (신규,
  `6af73b2c8`).

## 발견사항

없음 (CRITICAL/WARNING 없음).

- **[INFO] 원칙명 리네임(`boundary masking parity` → `egress masking parity`) 전수 스윕이
  spec/ 기준으로 완결됨을 실측 확인**
  - target 위치: `spec/5-system/14-external-interaction-api.md:1530`, `spec/5-system/6-websocket-protocol.md:196`
  - 과거 결정 출처: `spec/2-navigation/14-execution-history.md` R-5 "정정 (2026-08-24)" 블록
    (엔진 boundary 마스킹 제거 → egress-only 마스킹) + 그 직후 원칙명이 `boundary masking
    parity`에서 `egress masking parity`로 개명된 이력(`6af73b2c8` 커밋 메시지가 자인).
  - 상세: `git grep -n "boundary masking parity" spec/`는 **0건**, `"egress masking parity"`는
    정확히 **4건**(`14-execution-history.md`×2 자기인용, EIA §R17 인용, WS §4.1 인용) — 커밋
    메시지가 주장한 "spec 기준 egress 4 / boundary 0"과 실측이 일치한다. `plan/complete/**`
    3개 파일에만 옛 이름이 남아 있는데, 이는 완료 스냅샷을 소급 수정하지 않는다는 이 저장소의
    기존 관례(코드 리뷰 `12_52_43` INFO 7과 동일 판단, 커밋 메시지에도 명시)와 부합해 결함이
    아니다.
  - `spec/conventions/node-output.md` Principle 0의 동반 정정(`config: 해석된 설정값 (자격증명
    제거)` → 취소선 + "핸들러가 echo 한 원문 설정값 — 자격증명도 원문 그대로")도 같은 축의
    누락(리네임된 원칙 문장에 `maskSensitiveFields`라는 구현 심볼이 없어 이전 전수 스윕이
    놓친 것)을 메운 것으로, Principle 7("마스킹은 egress에서만")과의 내부 모순을 해소했다.
    앵커 링크(`#principle-7--config-echo-원칙-nodehandleroutputconfig`)도 heading의 slug
    규칙(백틱/괄호/마침표 제거, 공백·em-dash를 하이픈으로)과 문자 단위로 일치함을 확인했다.
  - 제안: 조치 불필요. 이 리네임 스윕은 구현 심볼(`maskSensitiveFields`) 축과 원칙명 축을
    별도로 관리해야 한다는 교훈(커밋 메시지 자체가 명시)이 남았으므로, 향후 이 원칙명이 또
    바뀌면 두 축을 모두 grep하는 것을 권장.

- **[INFO] "저장 시점 마스킹 제거"라는 결정 번복이 새 Rationale을 동반하고 있음을 재확인**
  - target 위치: `spec/5-system/4-execution-engine.md` `### Engine Raw Config Exposure` 절
    신규 blockquote, `codebase/backend/.../handler-output.adapter.ts`의 신규 주석.
  - 과거 결정 출처: R-5의 옛 서술("엔진 boundary에서 DB·WS·REST 모든 경로에 보편 마스킹 —
    저장 시점에 이미 마스킹") 및 이를 도입한 커밋(`abc0acf68`).
  - 상세: 이 결정 번복은 (a) 취소선으로 옛 문장을 보존하고, (b) 날짜(2026-08-24)와 번복 사유
    (표현식이 `$node["X"].config.<field>`로 원문을 읽어야 하는데 마스킹이 리터럴 `****abcd`를
    흘려보내는 기능 오염)를 명시하며, (c) 안전성 재확립 근거(REST `redactStoredDataForResponse`
    / WS `maskWireEnvelope`가 공유하는 `deepRedactSecrets*`의 키 축이 `DEFAULT_SENSITIVE_KEYS`를
    포함한다는 것을 `mask-sensitive-fields.util.spec.ts`의 포함관계 캐너리로 실측 보증)까지
    갖췄다. 이는 "결정의 무근거 번복"이 아니라 정본 요건(§3)을 충족하는 사례다. 또한 R-5의
    "config 탭이 viewer에 노출돼도 안전한 이유"라는 **결론**은 유지하되 **근거 메커니즘**만
    write-time→read-time으로 정정했고, 그 결정이 만든 두 가지 새 비용(크로스-노드 자격증명
    릴레이, safe-by-construction→safe-by-convention)까지 R-5 안에 명시적으로 적어 두어
    (이미 이전 라운드에서 반영, 이번 diff는 건드리지 않음) 은폐된 trade-off가 없다.
  - 제안: 조치 불필요.

- **[INFO] "레이어드 마스킹은 경쟁하지 않고 쌓인다" 원칙과의 프레이밍 충돌(19_26_06 WARNING) 해소 확인**
  - target 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts`의
    신규 주석, `spec/conventions/egress-masking.md`의 신규 blockquote.
  - 과거 지적: `19_26_06` 라운드가 "이 작업을 '중복 제거'로 프레이밍하는 것은 EIA §R17의
    '두 층은 경쟁하지 않고 쌓인다' 설계 철학과 어긋난다"고 지적한 바 있다.
  - 상세: 현재 문구는 "config만 storage-time 마스킹으로 **예외**였다"·"EIA §R17의
    egress-only 원칙과 정렬된다"로 프레이밍되어 있어, "중복 제거"가 아니라 "예외를 원칙에
    맞춰 정렬"로 언어가 교정되어 있다. 앞선 WARNING이 요구한 화해가 이미 반영된 상태다.
  - 제안: 조치 불필요.

## 요약

이번 impl-done 스코프(spec/5-system/)의 실질 변경은 R-5 원칙명 리네임(`boundary masking
parity` → `egress masking parity`)의 잔여 미러 3곳(EIA §R17, WS §4.1, execution-history 자기인용)
동기화와, 이미 클린 판정을 받은 `4-execution-engine.md`의 allow-list 서술 정정이다. 직접 grep
실측으로 spec/ 전체에서 옛 원칙명이 완전히 사라졌고(`plan/complete/**`의 3건은 관례상 의도적
잔존) 새 원칙명이 정확히 4곳에 자리 잡았음을 확인했다. `node-output.md` Principle 0의 동반
정정도 같은 리네임 축의 누락을 메운 것으로 Principle 7과의 내부 모순을 해소했고, 앵커 링크도
문자 단위로 검증했다. 더 넓게는 이 브랜치 전체가 다루는 결정 번복("config echo 마스킹을
저장 시점에서 egress 시점으로 이동")도 취소선·날짜·SoT 링크·재검증된 안전 근거(포함관계
캐너리)를 모두 갖춘 모범적인 Rationale 연속성 유지 사례이며, 앞선 라운드가 지적한 "레이어드
마스킹은 쌓인다" 원칙과의 프레이밍 충돌도 현재 문구에서는 해소되어 있다. 기각된 대안의
재도입, 합의 원칙 위반, 무근거 번복, 암묵적 invariant 우회 중 어느 것도 발견되지 않았다.

## 위험도

NONE
