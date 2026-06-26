# Cross-Spec 일관성 검토 결과

- 검토 모드: `--impl-done`
- 대상 spec: `spec/2-navigation/6-config.md`
- diff-base: `origin/main`
- 검토 일시: 2026-06-26

---

## 발견사항

### [INFO] `spec/5-system/7-llm-client.md` 가 해결된 forwardRef 순환을 여전히 "백로그 대기" 로 기술

- **target 위치**: `codebase/backend/src/modules/llm/llm.module.ts` — `forwardRef` 제거 + 단방향 import 전환 (C-2 cluster 4)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/spec/5-system/7-llm-client.md` §5.4 line 443, §Rationale line 476
  - 443: "모듈 의존은 `LlmModule → ModelConfigModule`(상호 forwardRef; **순환 정리는 백로그 `unified-model-management §7 W4`**)"
  - 476: "이로 인해 `LlmModule → ModelConfigModule` 상호 forwardRef 순환이 생겼고, 그 정리는 백로그 `unified-model-management §7 W4` 로 추적한다(런타임 위험 없음)"
- **상세**: 이번 refactor(C-2 cluster 4)가 정확히 해당 백로그 항목을 이행했다. `forwardRef` 가 제거되고 `LlmModelConfigController` 분리 + `ModelConfigService.onConfigInvalidated` 옵저버로 순환이 소멸했다. spec 은 이 상태를 "해결됨"으로 갱신하지 않았으므로 문서가 구현보다 낡아 있다.
- **제안**: `spec/5-system/7-llm-client.md` §5.4 (line 443) 와 §Rationale (line 476) 에서 "백로그 W4" 참조를 삭제하고 "C-2 cluster 4 (refactor-02) 에서 해소됨" 으로 대체. 동일 배경을 `spec/2-navigation/6-config.md` §B.3 API 표 아래 note 로 추가하면 추적성 개선.

---

### [INFO] `POST /api/model-configs/:id/test` 에 명시적 역할 가드 없음 — 기존 동작 유지이나 spec 의 일반 규칙과 불일치

- **target 위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` `testConnection` 핸들러 — `@Roles` 데코레이터 없음
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-02-c2-llm-modelconfig-93cae7/spec/2-navigation/6-config.md` §B.3 API 표 line 271: "mutation (POST / PATCH / DELETE) 은 **Editor+**"
- **상세**: `POST :id/test` 는 HTTP 메서드 기준 POST 이므로 spec 의 일반 규칙("POST mutation = Editor+") 아래 `@Roles('editor')` 가 예상된다. 그러나 `testConnection` 는 데이터 변경 없이 외부 연결만 검증하는 액션 엔드포인트다. 기존 `ModelConfigController` 에서도 동일하게 `@Roles` 없이 동작했으며, 이번 refactor 는 이 행동을 그대로 `LlmModelConfigController` 로 이식했을 뿐이다. `preview-models` 가 `@Roles('editor')` 를 갖는 것과 대비된다 — 두 엔드포인트 모두 외부 API 호출을 실행한다는 점에서 일관성 의문이 남는다.
- **제안**: (a) `spec/2-navigation/6-config.md` §B.3 API 표 note 에 "`test`·`models` 엔드포인트는 데이터 mutation 이 아닌 action 엔드포인트로 역할 가드 면제"를 명시하거나, (b) `testConnection` 에 `@Roles('editor')` 를 추가해 `preview-models` 와 일관되게 맞춘다. 보안 영향은 낮음(workspace 멤버 전체가 이미 viewer 이상이며 외부 호출은 저장된 자격증명으로만 가능). 현재로선 pre-existing 동작이므로 차단하지 않는다.

---

## 요약

이번 구현 변경(C-2 cluster 4)은 `spec/5-system/7-llm-client.md §Rationale` 이 명시적으로 백로그(`unified-model-management §7 W4`)에 등록했던 `LlmModule ↔ ModelConfigModule` forwardRef 순환을 해소한 것이다. 공개 API 계약(`/api/model-configs` 라우트·HTTP 메서드·요청/응답 형태)은 그대로 유지되고, `@Roles('editor')` 가드는 `preview-models` 에 보존됐으며, 데이터 모델 변경은 없다. 발견된 두 항목 모두 INFO 수준으로, 하나는 spec 문서 동기화(해결된 백로그 참조 제거), 다른 하나는 기존 동작의 역할 가드 정책 명확화 요청이다. CRITICAL·WARNING 발견 사항 없음.

## 위험도

LOW
