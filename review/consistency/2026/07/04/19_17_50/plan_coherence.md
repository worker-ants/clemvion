### 발견사항

- **[WARNING]** `spec/data-flow/3-execution.md` §2.2 큐 카탈로그 표가 본 PR 이 갱신한 §1.2 서술과 자기모순
  - target 위치: `spec/data-flow/3-execution.md` 큐 카탈로그 표, `execution-run` 행 (208행): `"priority manual > 트리거"`
  - 관련 plan: `plan/in-progress/exec-intake-followups.md` — `[x] priority 3-tier (webhook/schedule 세분화)` (완료 처리된 항목)
  - 상세: 본 PR 의 diff(`git diff origin/main -- spec/data-flow/3-execution.md`)를 보면 같은 파일 §1.2(68행)의 `priority` 서술은 "현재 `ExecuteOptions` 가 trigger type 을 싣지 않아 실제로는 manual > 그 외 이분(2-tier)" → "`triggerType` threading 구현 완료(2026-07-04), `manual`>`webhook`>`schedule` 3-tier" 로 정확히 갱신됐다. 그런데 같은 파일 아래쪽(208행)의 큐 카탈로그 표 `execution-run` 행은 여전히 옛 표현 `"priority manual > 트리거"`(2-tier 뉘앙스)로 남아 있어, 한 문서 안에서 §1.2(3-tier 명시)와 §2.2(2-tier 로 읽히는 표현)가 충돌한다. `spec/5-system/4-execution-engine.md` 는 동일 큐 카탈로그 표(§9.3, 1139행)에서 `"BullMQ job priority 3-tier manual(1)>webhook(2)>schedule(3) (triggerType threading 구현 완료 2026-07-04)"` 로 정확히 갱신했으므로, 이 파일만 동기화가 누락된 것으로 보인다.
  - 제안: `spec/data-flow/3-execution.md` 208행의 `"priority manual > 트리거"` 를 `"priority manual(1)>webhook(2)>schedule(3) (triggerType threading, 2026-07-04 구현 완료)"` 등으로 §1.2·`5-system/4-execution-engine.md` §9.3 표현과 정합시켜야 한다. 코드는 이미 3-tier 로 구현돼 있으므로(§4.3 diff 확인) target 문서(spec) 쪽 수정이며, plan 추가 생성은 불필요 — `exec-intake-followups.md` 항목의 fix 로 흡수 가능한 잔여 편집.

- **[INFO]** priority 3-tier 관련 landed spec-draft 2건이 `plan/in-progress/` 에 잔존 (하우스키핑)
  - target 위치: 없음 (target 자체와는 무관, plan 라이프사이클 관찰)
  - 관련 plan: `plan/in-progress/spec-draft-concurrency-cap-pr2b.md`(PR2b, #800, 2026-07-04 14:32 커밋으로 이미 착지) · `plan/in-progress/spec-update-execution-engine-pr4.md`(PR4, #798, 2026-07-04 13:38 커밋으로 이미 착지)
  - 상세: 두 문서 모두 "priority 3-tier 는 별도 후속/Planned 로 유지" 라는 **당시 시점**의 정확한 스코프 기록이며, 각자의 PR(#800/#798)이 이미 머지·반영된 landed 산출물이다. 새로 확인한 `exec-intake-followups.md` 의 priority 3-tier 완료 항목과 직접 충돌하는 미해결 결정은 아니다 — 두 문서는 "그 시점에는 3-tier 를 일부러 제외했다"는 역사적 사실을 그대로 보존하고 있을 뿐, 현재 스펙 상태를 재주장하지 않는다. 다만 두 plan 이 이미 완료된 작업(#798/#800)임에도 `plan/in-progress/`에 남아 있어 `plan/complete/`로의 이동이 밀려 있는 상태로 보인다.
  - 제안: target(priority 3-tier PR)과 직접 관련된 조치는 불필요. 라이프사이클 정리(complete/ 이동) 는 별도 housekeeping 으로 project-planner/개발자가 처리할 사항.

### 요약
priority 3-tier 구현은 `plan/in-progress/exec-intake-followups.md` 의 해당 체크박스를 정확히 완료 처리했고, `spec/5-system/4-execution-engine.md`(§4.3/§8/§9.3)의 상태 배너·admission gate 서술·큐 카탈로그가 모두 일관되게 "구현 완료"로 갱신됐으며, 이전 계획 문서(`exec-intake-queue-impl.md`)에서 새 후속 문서로의 참조 전환도 정확하다. 미해결 결정을 일방적으로 우회하는 CRITICAL 급 충돌은 없다. 다만 같은 PR 이 손댄 `spec/data-flow/3-execution.md` 내부에서 §1.2 서술(3-tier로 정확히 갱신)과 §2.2 큐 카탈로그 표(구 2-tier 표현 잔존)가 자기모순 상태로 남아 소규모 후속 편집이 필요하다. 이 외 in-progress plan 중 이 변경의 전제나 후속 항목을 무효화하는 사례는 발견되지 않았다.

### 위험도
LOW

BLOCK: NO
STATUS: SUCCESS
