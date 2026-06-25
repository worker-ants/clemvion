# Plan 정합성 검토 결과

검토 모드: `--impl-done` (구현 완료 후)
Target: `plan/in-progress/web-chat-preview-improvements.md`
기준: `plan/in-progress/**` 전체 vs 구현 diff (origin/main...HEAD)

---

## 발견사항

### [INFO] Phase 4(b) 의 "§8 매핑 테이블(L848~)" 참조가 부정확
- target 위치: `plan/in-progress/web-chat-preview-improvements.md` Phase 4 항목 1-(b)
- 관련 plan: 동일 파일 자체 내 문서 오류
- 상세: 계획서는 `spec/5-system/14-external-interaction-api.md` "§8 매핑 테이블(L848~)에 `execution.message` 행 추가"를 명시한다. 그러나 실제 §8 은 보안(Security) 섹션이고, L848 은 §10.1(Swagger/API 문서) 본문이다. WS 명령 ↔ 외부 명령 매핑 표는 §11 에 있다. 이 표는 client→server 명령 매핑으로, `execution.message`(server→client SSE push)를 추가할 올바른 위치가 아니다. 구현 diff 는 §5.2 와 Rationale §R18 에 `execution.message`를 정확히 추가했고, §11 은 건드리지 않았다 — 구현 판단은 옳다.
- 제안: plan 의 "§8 매핑 테이블(L848~)" 참조를 삭제하거나 "해당 없음(server→client push 이벤트는 §11 WS 명령 매핑 대상이 아님)"으로 정정. 구현이 이미 완료됐으므로 plan 문서 정정으로 족하다.

### [INFO] fix-webchat-sse-field-map.md — 완료이동 미수행 인지 여부
- target 위치: `plan/in-progress/web-chat-preview-improvements.md` Phase 4(d) — "I7: fix-webchat-sse-field-map.md 가 §6.2 를 건드릴 예정"
- 관련 plan: `plan/in-progress/fix-webchat-sse-field-map.md` — 체크박스 `[ ] plan complete 이동` 미완
- 상세: target 이 fix-webchat-sse-field-map 의 §6.2 간섭을 인지해 "§6.2 구간 회피, 신규 절에만 추가"로 대응했다. 이는 올바른 처리다. 그러나 fix-webchat-sse-field-map.md 자체는 비차단 backlog 잔여로 여전히 `in-progress/` 에 있는 상태임 — target 변경이 이 상태를 변경하지 않는다. 별개 plan 의 lifecycle 문제이며 본 target 과 충돌하지 않는다.
- 제안: 추적만. fix-webchat-sse-field-map plan 의 완료이동 여부는 해당 plan 책임자가 별도 처리한다.

### [INFO] spec-sync-carousel-gaps.md — layout 결정 미해결이나 target 과 무관
- target 위치: `codebase/backend/src/common/constants/presentation.ts` — `PRESENTATION_NODE_TYPES` 에 `carousel` 포함
- 관련 plan: `plan/in-progress/spec-sync-carousel-gaps.md` — `image`/`minimal` 레이아웃 UX 결정 미완(옵션 A/B/C 제시됨)
- 상세: target 구현은 carousel 을 "비차단 완료 시 `execution.message` 발행 대상" 4종 중 하나로 포함할 뿐이다. carousel 의 `layout` config 값별 렌더 변형(spec-sync-carousel-gaps 의 미결 사항)은 위젯 프론트엔드 렌더 경로의 문제로, `PRESENTATION_NODE_TYPES` 분류와 독립적이다. 충돌 없음.
- 제안: 추적 메모만. carousel layout 결정은 spec-sync-carousel-gaps plan 의 별도 scope.

---

## 요약

`plan/in-progress/web-chat-preview-improvements.md` 가 다루는 세 가지 기능(1. `execution.message` 신설, 2. 세션 초기화 command, 3. 2-column 미리보기 레이아웃)은 다른 in-progress plan 의 미해결 결정을 우회하거나 선행 조건을 무시하는 경우가 없다. Phase 4 spec 갱신(EIA §5.2·WS §4·2-sdk §3·5-admin-console §6)은 모두 diff 에서 확인된다. 유일한 이슈는 plan 내 "§8 매핑 테이블(L848~)" 참조가 실제 spec 섹션 번호와 불일치한다는 문서 오류이며, 구현 자체는 이를 올바르게 해석해 처리했다.

## 위험도

LOW
