# Plan 정합성 검토 — `spec/5-system/14-external-interaction-api.md` §5.2 처분 + plan 신규 절 검증

## 검토 범위

지시된 4개 항목을 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(실 파일, 129줄) ·
target `spec/5-system/14-external-interaction-api.md`(실 파일, 1314줄) ·
`review/consistency/2026/08/11/16_51_08/*.md`(5개 checker 산출물) 를 직접 열어 대조했다.

## 확인 결과 (지시된 4개 항목)

### 1. §5.2 처분이 실제로 됐는가 — 됐다

target `spec/5-system/14-external-interaction-api.md:428-429`:

> "**클라이언트 소비**: 서버 emit·위젯 리스너(`eia-client.ts`)·**소비 분기가 모두 구현**됐다(2026-07-17)... > 이 항목은 2026-07-17 에 닫혔으나 본 §5.2 만 "미배선(no-op)" 서술로 남아 있었다(2026-08-11 정정). 형제 문서 [1-widget-app §3.1] 은 이미 "모두 구현" 이라 적고 있었다..."

"미배선(no-op)" 이라는 옛 서술 전체가 "모두 구현됐다" + 정정 콜아웃으로 교체됐고, 인근에 모순되는
잔여 문구(예: 다른 자리의 "클라이언트 측 별도 후속" 류)도 없다(428행 전후 직접 확인). §3.3→§5.1
절 번호 오기(같은 라운드가 잡은 별개 발견, INFO)도 `interaction.service.ts` 주석·"§5.1 표" 인용
524행 부근에서 실제로 정정된 상태를 확인했다.

### 2. 새 절의 사실 주장 — 과장 없음, 전부 검증됨

`review/consistency/2026/08/11/16_51_08/{convention_compliance,cross_spec,rationale_continuity,plan_coherence,naming_collision}.md` 5개 파일을 전부 열어 대조했다.

| # | plan 이 적은 귀속 | 실측 |
|---|---|---|
| 1 | "convention · plan_coherence (독립 2명)" — §3.3→§5.1 오기 | **참**. `convention_compliance.md` WARNING #2("신규 콜아웃 2곳이 잘못된 절 번호(§3.3)를 인용")·`plan_coherence.md` INFO("§3.3 표... 실제로는 §5.1") 둘 다 존재. 두 checker 는 서로 다른 subagent(`convention-compliance-checker`/`plan-coherence-checker`)로 독립 실행됨(`_retry_state.json` 확인) |
| 2 | "convention · cross_spec (독립 2명)" — §1.6 미러 카탈로그 3종 누락 + "단일 401" 반례 | **참**. `convention_compliance.md` WARNING #1과 `cross_spec.md` WARNING(§1.6 미동기화 + "모든 토큰류 실패는 단일 401" 반례) 둘 다 동일 취지로 독립 지적 |
| 3 | "rationale_continuity · cross_spec" — §R14 본문 "모두 401(403 미사용)" 단정 | **참**. `rationale_continuity.md` WARNING("§R14 본문이... 신설을 스스로 설명하지 않음")과 `cross_spec.md` INFO(R14 제목·도입부가 §5.1 신규 행과 표면적으로 어긋남) 둘 다 존재 |
| 4 | "plan_coherence (보너스)" — §5.2 no-op 서술 stale | **참**. `plan_coherence.md` WARNING 전문이 정확히 이 내용(§5.2 "미배선" 서술이 2026-07-17 에 닫힌 plan 항목과 모순, 형제 문서 `1-widget-app.md` 는 이미 "모두 구현") |

5 checker(`cross_spec`/`rationale_continuity`/`convention_compliance`/`plan_coherence`/`naming_collision`,
`meta.json` 확인) 전원 BLOCK:NO 서술도 4개 파일에서 명시적 `BLOCK: NO` 라인으로 직접 확인했다. 단
`convention_compliance.md` 파일 하나만 말미에 명시적 `BLOCK:`/`STATUS:` trailer 라인이 없다(요약이
"CRITICAL 은 아니다"로 끝남) — 결론(BLOCK:NO 상당)은 본문과 위험도(MEDIUM)로 뒷받침되므로 plan 의
"전원 BLOCK:NO" 서술이 틀렸다고 보기는 어렵지만, 그 라운드의 산출물 하나가 호출 규약의 trailer
포맷을 안 지킨 것 자체는 사실이다(아래 INFO 참고).

**§5.1/§3.3 처분도 확인**: `3-error-handling.md:168-170` 에 refresh 전용 3코드가 실제로 추가됐고
같은 파일 171행의 "단일 401" 문구도 "검증 실패는 단일 401"로 좁혀졌다. `14-external-interaction-api.md`
의 `### R14` 절(1135-1155행)에도 "범위 명확화(2026-08-11)" addendum 이 실제로 붙어 있다 — 표 3곳
모두 새 절이 "전부 고쳤다"고 적은 그대로 target 에 반영돼 있다.

### 3. 이 plan 이 `[x]` 로 닫은 다른 항목 중, spec 이 아직 stale 한 것 — 추가 발견 없음

plan 의 모든 `[x]` 항목(총 9개 + 하위 후속 1개)을 훑고 각각 target/관련 spec 서술을 코드 인용
수준까지 대조했다:

| 닫힌 plan 항목 | 확인한 spec 자리 | 상태 |
|---|---|---|
| Outbound backoff 배율(§3.1 EIA-NX-06/§6.6) | `14-external-interaction-api.md:64`(EIA-NX-06) | "**구현됨**: base-4 custom backoff..." — stale 없음 |
| Inbound rate-limit 429(§5.1/§8.4) | `:348`, `:784`, `:786` | "**구현됨**" 3곳 모두 일치 |
| Outbound per-trigger rate-limit + degraded(§8.4/EIA-NX-11) | `:64`, `:787`, `:1285-1290`(R-outbound-flood) | "**구현됨**" 일치 |
| `getStatus` currentNode/context 실값(§5.3) | `:435-436`("구현 상태(V1)"), `:1177`(R17) | "실제 값으로 채워진다" — stale 없음 |
| SSE `execution.replay_unavailable` emit(§5.2/§11) | `:426`("(구현됨)"), `6-websocket-protocol.md:806`("구현됨 — SSE"), `data-flow/15:141` | 전부 일치 |
| ↳ (후속) 위젯 클라이언트 소비 | `:428-429` | 이번 라운드에 정정 완료(위 1번) |
| host `resetSession` booting coalesce | `7-channel-web-chat/1-widget-app.md:90,94,256-269`("**모두 구현됨**") | stale 없음 |
| 공개 위젯 idle-wait GC(EIA-RL-07) | `14-external-interaction-api.md:145`(EIA-RL-07), `:1304`(R19), `1-widget-app.md:94` | "**구현됨**" 일치 |
| §5.5 `410`(EXECUTION_TERMINATED) 응답 추가 + refresh 3코드 | `:508-541`(§5.5 응답 블록), `3-error-handling.md:168-170` | 이번 라운드에 정정 완료(위 2번) |
| 후속(cross-cutting) Redis INCR+EXPIRE 원자화 | (본 spec 밖, plan 스스로 "본 spec 밖" 명시) | target 미대상 — 확인 불요 |

빈손으로 끝나지 않게 인접 파일도 grep 했다 — `spec/` 전체에서 `no-op`/`미배선`/`아직 미구현` 류
문구가 남은 자리는 (a) 위에서 처분된 §5.2 자기-정정 콜아웃(429행, 이제는 "정정됨" 이라는 서술
자체), (b) 여전히 열려 있는 두 항목(분산 SSE fan-out `:1094-1095`, `nodeOutput` allowlist `:1254`)
뿐이었다 — 둘 다 plan 의 `[ ]` 미해결 항목과 정확히 대응하므로 stale 이 아니라 정합이다. (c) 632행의
"`expectedCommands` 자체는 현재 미구현 문서 필드다" 는 이 plan 이 다룬 어떤 항목과도 무관한 별개
서술이라 이 라운드의 범위 밖이다.

억지로 만든 발견은 없다 — 이번 라운드에서 이 항목은 "추가 발견 없음"이 결론이다.

### 4. plan 이 `in-progress` 유지가 맞는가 — 맞다

`## 미구현 항목` 에 `[ ]` 2건(분산 SSE/notification fan-out §R10, `getStatus` nodeOutput
키-allowlist §R17 잔여)이 여전히 남아 있고, target frontmatter 도 `status: partial` +
`pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]` 를 유지한다 —
두 미해결 항목이 정확히 그 이유다. lifecycle 상 문제 없음.

## 발견사항

- **[INFO]** `review/consistency/2026/08/11/16_51_08/convention_compliance.md` 가 호출 규약의
  `BLOCK:`/`STATUS:` trailer 라인 없이 종료됨
  - target 위치: 해당 파일 없음(과거 리뷰 산출물의 협약 준수 이슈, 이번 target diff 의 결함은
    아님)
  - 관련 plan: 이번 신규 절 "전원 BLOCK:NO" 서술의 근거 파일 중 하나
  - 상세: 5개 checker 산출물 중 4개는 파일 말미에 명시적 `BLOCK: NO` / `STATUS: OK` 라인이 있지만
    `convention_compliance.md` 는 `## 위험도\n\nMEDIUM` 으로 끝나고 trailer 가 없다. 내용상 CRITICAL
    발견이 없어(WARNING 2건·INFO 2건) BLOCK:NO 로 취급한 판단 자체는 합리적이나, 산출물 포맷이
    `subagent-call-contract.md` 를 따르지 않은 채로 plan 문서에 "전원 BLOCK:NO" 로 인용된 것은
    사실이다. plan 문서를 틀렸다고 볼 근거는 아니라 CRITICAL/WARNING 이 아닌 INFO 로만 남긴다.
  - 제안: 조치 불요 — 과거 리뷰 산출물은 수정 대상이 아니다. 참고용 메모.

## 요약

지시된 4개 확인 항목 모두 통과했다. §5.2 의 "미배선(no-op)" stale 서술은 실제로 "모두 구현" +
정정 콜아웃으로 교체됐고, 새로 추가된 "consistency 라운드가 넷을 더 잡았다" 절의 사실 주장(귀속
포함 "독립 2명" 서술 2건)은 `16_51_08` 세션의 5개 checker 산출물을 직접 대조해 전부 검증됐다 —
과장이나 지어낸 이력은 없었다. plan 이 `[x]` 로 닫은 나머지 8개 항목(+ 후속 1개)도 전부 target
및 형제 spec 문서(`1-widget-app.md`, `3-error-handling.md`, `6-websocket-protocol.md`,
`data-flow/15-external-interaction.md`)와 대조했으나 추가 stale 서술은 발견되지 않았고, 남은 두
`[ ]` 항목(분산 SSE fan-out, nodeOutput allowlist)은 target 에도 정확히 "미구현" 으로 정합하게
표시돼 있다. plan 이 `in-progress` 로 남는 것도 타당하다. 유일한 부수 관찰은 과거 리뷰 산출물
하나(`convention_compliance.md`, `16_51_08`)가 trailer 포맷을 안 지킨 것인데, 이번 target diff 나
plan 문서의 결함은 아니라 INFO 로만 기록한다.

## 위험도
NONE

BLOCK: NO
STATUS: OK
