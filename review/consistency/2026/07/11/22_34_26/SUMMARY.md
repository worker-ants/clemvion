# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**NONE** — `spec/5-system/14-external-interaction-api.md` 대상 diff 는 behavior-preserving 순수 리팩터(`Webchat`→`WebChat` casing 정정, `emitCancellationEvent`/`processInBatches` 공용 헬퍼 추출)이며 5개 checker 전원이 위험도 NONE, Critical/Warning 0건, INFO 5건만 보고했다. `plan/in-progress/refactor-reaper-dry.md` 스코프와 diff 가 1:1 대응하고, 공개 계약(에러 코드·큐명·env·`cancelledBy` 닫힌 union·`error` 키 present-when-available)은 전혀 변경되지 않았다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | `WebChat` 복합어 대소문자 규약이 `spec/conventions/**` 어디에도 명문화돼 있지 않음(이번 diff 는 기존 위반의 교정이지 신규 위반은 아님) | 해당 규약 부재 (target 문서 자체는 변경 없음) | `spec/conventions/swagger.md` 등에 "고유 도메인 복합어는 각 단어를 대문자로 시작해 프로젝트 전체 단일 표기 유지" 1문장 원칙 추가 검토(필수 아님) |
| 2 | Rationale Continuity | `emitCancellationEvent`/`processInBatches` 공용 헬퍼 추출이 과거 "기각된 대안 — 재개 식별 필드 hydration 전용 헬퍼"(`spec/5-system/4-execution-engine.md` §Rationale) 선례와 표면적으로 대칭돼 보이나, 대상 4/2 호출부가 구조적으로 완전 동형이라 기각 사유(타이핑 SoT 상이·shape 상이)가 성립하지 않는 반대 케이스임을 확인 | `execution-engine.service.ts` `emitCancellationEvent`, `common/utils/process-in-batches.ts` | 조치 불요. 향후 유사 추출 PR 판단 기준으로 "구조 동형 여부"를 §Rationale 에 원칙화하는 것을 고려 가능 |
| 3 | Cross-Spec | 신설 `emitCancellationEvent` 헬퍼의 TS 타입(`error: { code; message }` — message 필수)이 wire 계약(`spec/5-system/6-websocket-protocol.md:179`, `message?` optional)보다 다소 엄격 — 현재 4개 호출부 전부 message 를 채워 호출하므로 런타임 영향 없음 | `execution-engine.service.ts` `emitCancellationEvent` 시그니처 | 조치 불요(참고). 향후 message 없이 emit 하는 경로가 생기면 `message?: string` 완화 검토 |
| 4 | Plan Coherence | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 이미 완료([x]) 처리된 한 항목이 rename 이전 식별자(`WebchatIdleReaperService`/`markWebchatIdleTimeout`)를 여전히 인용해 표기가 stale — target spec 본문·나머지 4개 spec_impact 파일은 모두 최신 표기로 갱신됨(SoT 영향 없음) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (완료 항목) | 급하지 않은 텍스트 지연. 원하면 `refactor-reaper-dry.md` 완료 처리 시 함께 정정 |
| 5 | Naming Collision | `codebase/backend/src/common/utils/` 디렉토리에 `.util.ts` 접미(`crypto.util.ts` 등)와 무접미(`with-timeout.ts`, 신규 `process-in-batches.ts`) 네이밍 패턴이 혼재 — 기존에도 이미 혼재했던 패턴이라 이번 diff 가 새로 유발한 비일관성은 아님(SoT 규약 부재) | `codebase/backend/src/common/utils/process-in-batches.ts` | 조치 불요(참고). `spec/conventions/` 에 이 계층 네이밍 SoT 없음 — 필요 시 향후 별도 정리 검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 다른 spec 영역과 직접 모순 없음. `Webchat`→`WebChat` 리네이밍은 기존 spec 표기(EIA/channel-web-chat/data-flow 5개 문서)와의 drift 해소이며 신규 drift 아님. `cancelledBy`/`error` payload 계약 보존 확인 |
| Rationale Continuity | NONE | 헬퍼 추출이 과거 "기각된 대안" 선례와 표면 대칭이나 구조 동형성 기준에서 반대 케이스임을 확인, 합의 원칙 위반·무근거 결정 번복 없음 |
| Convention Compliance | NONE | `error-codes.md` §2 rename-안정성, `api-convention.md` §5.4 present-when-available, target §6.5 닫힌 3값 union 모두 준수. 파일/클래스 명명 컨벤션 정합 |
| Plan Coherence | NONE | diff 가 `plan/in-progress/refactor-reaper-dry.md` 스코프와 1:1 대응, 다른 in-progress plan 의 미해결 결정과 충돌 없음 |
| Naming Collision | NONE | 요구사항 ID·클래스/타입명·엔드포인트·이벤트명·환경변수·파일경로 6개 관점 전부 충돌 없음. `WEBCHAT_` prefix 선택 근거가 spec Rationale 에 이미 문서화됨 확인 |

## 권장 조치사항
1. (BLOCK 해소 불요 — Critical 없음) 현재 diff 는 머지 차단 사유 없음.
2. (선택, 낮은 우선순위) `spec/conventions/swagger.md` 등에 도메인 복합어 casing 규칙(예: `WebChat`) 1문장 명문화 — 향후 유사 표류 예방.
3. (선택, 낮은 우선순위) `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 완료 항목의 stale 식별자 표기(`Webchat*`)를 `refactor-reaper-dry.md` 완료 처리 시 함께 정정.