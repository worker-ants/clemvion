### 발견사항

- **[INFO]** `outputData` 공개 EIA 표면 노출 — 정책 문서화만, 런타임 필터링 없음
  - 위치: `interaction.service.ts` `getStatus()` — 라인 493–528 (context 구성 블록)
  - 상세: `NodeExecution.outputData` 전체를 `nodeOutput: out` 으로 직접 동봉한다. 현재 JSDoc 에 "민감 데이터를 outputData 에 기록 금지" 규약이 명기됐지만, 이는 노드 핸들러 작성자에 대한 가이드라인이지 런타임 필터가 아니다. 규약 위반 노드가 outputData 에 API 키·PII 등을 기록하면 해당 값이 공개 SSE 스트림 및 REST `/status` 응답으로 그대로 유출된다. SSE wire 포맷도 동일 경로(`sse-adapter.service.ts` fanout)를 사용하므로 동일한 리스크를 공유한다.
  - 제안: (a) 단기 — 현재 JSDoc 규약과 별도로 `getStatus()` 반환 전 `outputData` 에서 노출 허용 키(`meta`, `formConfig`, `conversationConfig`, `buttonConfig`) 외 나머지를 strip 하는 allowlist 필터를 추가한다. (b) 중기 — 노드 핸들러가 outputData 에 쓸 때 interaction-safe 필드와 internal-only 필드를 구조적으로 분리하도록 NodeHandlerOutput 타입을 변경하고, SSE fanout seam 에서 internal 섹션을 strip 한다.

- **[INFO]** `per_trigger` 토큰이 `Trigger.config` JSONB 평문 저장
  - 위치: `spec/5-system/14-external-interaction-api.md` §7.1 / §8.3 명기
  - 상세: `config.interaction.triggerToken` (`itk_*`)은 현재 secret_store 미통합 상태로 DB JSONB 에 평문 저장된다고 스펙에 명시("현재 JSONB 평문, 향후 secret store 통합 검토"). `per_execution` 토큰(`iext_*`)은 단명 JWT 이고 실제 secret 은 env var 로 관리되므로 문제 없지만, `itk_*` 는 장기 opaque 토큰으로 DB dump·백업·로그 노출 시 직접 악용 가능하다.
  - 제안: `itk_*` 도 `notification.signing.secretRef` 패턴과 동일하게 secret_store 에 AES-256-GCM 암호화 후 ref 만 config JSONB 에 저장하도록 마이그레이션한다. 이는 스펙에서 이미 "향후 통합 검토"로 언급된 항목이므로 backlog 에 명확한 priority 를 부여할 것을 권고한다.

- **[INFO]** `configFromQuery()` — query param 으로 `apiBase` / `triggerEndpointPath` 수신
  - 위치: `use-widget.ts` 라인 957–964, `applyConfig()` 라인 1318–1341
  - 상세: query param 으로 받은 `apiBase` 값이 `EiaClient({ apiBase })` 생성자에 그대로 주입된다. `triggerEndpointPath` 도 `encodeURIComponent`(fetchEmbedConfig 내부)로 처리되지만 `apiBase` 자체에 대한 schema 제한이나 sanitize 없이 모든 URL 이 허용된다. 공격자가 직접 위젯 URL 을 로드해 `?apiBase=https://evil.example` 를 주입하면 토큰·세션 데이터가 악의적 서버로 전송될 수 있다. 단, 위젯 아이프레임 내 코드이며 정상 임베드 경로(host-bridge `onBoot`)에서는 parent origin 으로부터 구성을 수신하므로 실제 공격 면적은 "직접 URL 접근" 시나리오에 한정된다.
  - 제안: `configFromQuery()` 에서 `apiBase` 를 허용 schema 목록(`https:`)과 비교 검증하거나, dev/preview 환경에서만 활성화되도록 빌드 플래그로 제어하는 것을 검토한다. 프로덕션 위젯은 host-bridge `onBoot` 경로가 유일한 구성 소스가 되도록 제한하면 이 공격 벡터가 구조적으로 제거된다.

- **[INFO]** `getStatus()` 에서 실행 조회 시 `select` 필드 미지정 — 전체 컬럼 로드
  - 위치: `interaction.service.ts` 라인 468–470
  - 상세: `loadAndAssertAlive()` 는 `select: ['id', 'status']` 를 명시하지만, `getStatus()` 의 첫 번째 `executionRepository.findOne` 은 `select` 없이 전체 컬럼을 로드한다. `Execution` 엔티티에 민감 필드가 추가될 경우 `result`/`error` 이외의 컬럼도 메모리에 로드되며 의도치 않게 응답에 포함될 가능성이 생긴다. 현재 응답 구성 코드는 특정 필드만 매핑하므로 직접 누출은 없으나, 엔티티 확장 시 실수 가능성이 있다.
  - 제안: `getStatus()` 도 필요한 컬럼 (`id`, `workflowId`, `status`, `outputData`, `finishedAt`, `startedAt`, `createdAt`)을 `select` 로 명시해 최소 권한 원칙을 적용한다.

### 요약

이번 변경의 핵심은 JSDoc 보안 제약 명기, 변수명 명확화(`it` → `rawInteractionType`), `SSE_SEQ_PLACEHOLDER` named const 추출, TypeORM `@Index` 추가, 그리고 seedWaitingFromStatus JSDoc 보강으로 구성된 문서화·코드 품질 개선이다. 인젝션·하드코딩 시크릿·인증 우회·암호화 알고리즘 등의 직접적인 신규 취약점은 도입되지 않았다. 다만 `NodeExecution.outputData` 전체를 allowlist 없이 공개 EIA 표면에 동봉하는 패턴은 JSDoc 규약만으로는 노드 핸들러 실수를 막을 수 없어 런타임 필터 보강이 권고된다. `itk_*` 토큰의 DB 평문 저장은 기존 설계 결정이나 스펙이 이미 위험을 인식하고 있으므로 migration 우선순위를 명확히 할 것을 권고한다.

### 위험도

LOW
