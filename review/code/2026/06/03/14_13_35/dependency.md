# Dependency Review

## 발견사항

이번 변경은 **전체 19개 파일이 모두 `spec/` 디렉토리 하위 Markdown 문서**다. 패키지 매니페스트(`package.json`, `pyproject.toml`, `requirements.txt` 등) 또는 코드 파일에 대한 변경이 없으므로, 외부 패키지 의존성 관점에서는 직접적인 변경이 없다.

단, 스펙 문서가 기술적 의존 관계를 기술하므로 **스펙에서 언급된 라이브러리/서비스 의존 관계의 정합성**과 **내부 모듈 의존성 변경 사항**을 점검한다.

---

### [INFO] 새 외부 의존 언급 — `cron-parser` (CronExpressionParser)

- 위치: `spec/data-flow/10-triggers.md` §3.2
- 상세: `cron-parser` 라이브러리의 API 참조가 `parseCron()` 에서 `CronExpressionParser.parse` 로 갱신됐다. 이는 API 변경을 문서화한 것이며, 코드 수준에서 패키지 추가/교체가 일어났는지는 이번 변경 범위에서 확인 불가.
- 제안: 해당 `package.json`에서 `cron-parser` 버전이 `CronExpressionParser` 네이밍을 도입한 버전(v4.x)으로 고정되어 있는지 확인 권장.

---

### [INFO] 내부 모듈 의존 관계 명세 변경 — `workflow-assistant` 모듈

- 위치: `spec/data-flow/11-workflow.md` §1.4
- 상세: `workflow-assistant` 모듈이 `NodesService` / `EdgesService` 를 **import하지 않는다**는 사실이 명시됐다. 이전 스펙은 tool_call 이 이 서비스들을 통해 DB 에 반영된다고 기술하고 있었으나, 실제 구현은 `ShadowWorkflow` in-memory 방식으로 동작하며 `NodesService` / `EdgesService` 에 대한 모듈 의존이 제거됐음을 문서화했다. 내부 의존 방향이 변경된 중요한 아키텍처 사실이다.
- 제안: 해당 모듈의 `workflow-assistant.module.ts` imports 배열에 `NodesService` / `EdgesService` 참조가 실제로 없는지 코드 레벨 재확인 권장.

---

### [INFO] 내부 모듈 의존 관계 — `AuthConfigsService` 위임

- 위치: `spec/data-flow/10-triggers.md` §1.2
- 상세: 웹훅 인증 로직(`ip_whitelist`, `last_used_at` 갱신 등)이 `HooksService` 직접 구현에서 `AuthConfigsService.verifyWebhookRequest` 로 위임됐음이 명시됐다. 내부 서비스 의존 방향이 변경된다(hooks → auth-configs 단방향 의존).
- 제안: 서비스 간 순환 의존이 발생하지 않는지 확인 권장.

---

### [INFO] 내부 의존 관계 — `WorkflowAssistant` SSE 직접 응답 (WebSocket 비경유)

- 위치: `spec/data-flow/11-workflow.md` §1.3, §2.2, §4
- 상세: Assistant 스트리밍이 `WebsocketService` 경유에서 Controller 직접 SSE(`res.write`)로 변경됐음이 명시됐다. 이는 `workflow-assistant` 모듈의 `WebsocketService` 에 대한 런타임 의존이 제거됐음을 의미하며, 아키텍처 단순화다.
- 제안: 이 변경이 실제 `WebsocketService` import 제거까지 완료됐는지 코드 레벨 확인 권장.

---

### [INFO] 스크립트·CI 파일 스펙 등재 — `scripts/check-migration-versions.py`, `.github/workflows/`

- 위치: `spec/conventions/migrations.md` frontmatter `code:` 목록
- 상세: Python 스크립트(`check-migration-versions.py`)와 GitHub Actions 워크플로우 파일이 스펙 code 목록에 등재됐다. 이는 기존에 존재하던 파일들을 스펙에서 명시한 것이며, 새 의존성 추가는 아니다.
- 제안: Python 스크립트에서 사용하는 표준 라이브러리 이외 패키지가 있는지 확인 권장(현재 스펙에서는 파악 불가).

---

### [INFO] `secret_store` DB 가드 추가 명세 (V063 migration)

- 위치: `spec/conventions/secret-store.md`
- 상세: `ref` 컬럼에 CHECK 제약(`chk_secret_store_ref_format`)이 추가됐음이 문서화됐다. DB 레벨 의존성 변경이며 외부 패키지 변경은 없다. Flyway 마이그레이션 V063에 해당한다.
- 제안: 없음 (정상적인 DB 스키마 진화).

---

## 요약

이번 PR의 19개 변경 파일은 **전부 `spec/` 하위 Markdown 문서**로, 코드/패키지 파일에 대한 직접적인 외부 의존성 추가·제거·버전 변경이 없다. 의존성 관점에서 주목할 사항은 스펙 문서가 기술한 **내부 모듈 의존 관계 변경** 세 가지다: (1) `workflow-assistant` 모듈의 `NodesService`/`EdgesService` 의존 제거 및 `ShadowWorkflow` in-memory 패턴 전환, (2) 웹훅 인증 로직의 `HooksService` → `AuthConfigsService` 위임, (3) Assistant 스트리밍의 `WebsocketService` 경유 제거·SSE 직접 응답 전환. 이 세 변경은 모두 의존 그래프를 단순화하는 방향이며, 순환 의존이나 새로운 외부 패키지 노출 없이 아키텍처를 개선한다. 외부 라이브러리(`cron-parser`) API 참조 갱신이 스펙에 반영됐으나, 이는 기존 의존 패키지의 내부 API 표기 수정이며 신규 추가가 아니다. 전반적으로 의존성 관점의 위험 요소는 없다.

## 위험도

NONE
