# Consistency Check SUMMARY — impl-done (post-rebase): EIA context 스키마화 vs merged #903

- 모드: `--impl-done` (scope `spec/5-system/14-external-interaction-api.md`, diff-base `origin/main`)
- 사유: `origin/main` 이 PR #903(getStatus 2단계 projection)·#901·#905 로 전진. 재베이스로 코드 커밋 시각이 갱신돼 직전 impl-done 리포트(23_46_04)가 predate → SPEC-CONSISTENCY 게이트 재발화. 병합 상태에 대한 spec↔code 정합 재검증.
- checker: 5/5 SUCCESS

## BLOCK: NO

**Critical 0 · Warning 0 · Info 소수.** 위험도 전원 NONE.

## 재검증 핵심 (병합 상태 기준)

- **wire 무변경 관철** (cross_spec): #903 의 2단계 조회는 `conversationThread` 만 조건부 재조회할 뿐 응답 조립 로직은 그대로. EIA §5.3 예시 JSON 과 병합된 `getStatus()` 실제 출력이 필드명·nullable·조건 모두 일치.
- **§R17 마스킹 불변식 보존** (rationale): `redactThreadForPublic` 이 REST(`interaction.service.ts:314`)와 SSE 3개 emit site(form/ai-turn/button interaction service)에서 **동일 helper 공유**됨을 grep 확인. #903 의 2단계 projection 은 조회 시점만 지연시켰을 뿐 마스킹 경로를 우회하지 않는다.
- **§1-4 / §5.4 준수** (convention): oneOf(discriminator 없음)·`@ApiExtraModels`·`conversationThread` 키 생략 vs `result`/`error`/`currentNode` nullable — 규약과 1:1. #903 의 `STATUS_PROJECTION_COLUMNS`(`satisfies (keyof Execution)[]`)가 본 브랜치 소비 필드(`conversationThread`/`result`/`error`)를 정확히 커버해 마찰 없음.
- **plan 정합** (plan_coherence): spec-sync plan 의 getStatus 항목에 #903 심볼 인용 + 내 축-분리 sub-bullet 공존(다른 관심사, 무모순). driving plan 은 complete/ 정상(전 `[x]`, spec_impact YAML 리스트). #903 의 `eia-getstatus-column-projection.md`(spec_impact: none)는 성능 축이라 직교. conflict marker 잔여 0.
- **명명 충돌 0** (naming): DTO 4종 신조어 충돌 없음. #903 `STATUS_PROJECTION_COLUMNS` 는 다른 파일·비-export·본 브랜치 미참조. §5.4 앵커는 파일 qualify 로 EIA 자신의 §5.4(명시적 취소)와 구분. #901/#905 webchat spec 은 §5.4 섹션 자체 없음.

## Info (본 PR 미조치, 재확인)

- 클라이언트 `context` 타입 미정밀화(`packages/sdk/src/client.ts`·`eia-types.ts`, `Record<string,unknown>|null`) — spec 충돌 아님, `eia-context-schema-followups.md` 에 이미 추적 중.

## 결론

재베이스로 편입된 #903(성능 축)과 본 브랜치(스키마 표현 축)는 직교하며, 병합 최종 상태에서 spec↔code 정합·Rationale 연속성·plan 정합·명명 모두 무결. 게이트 재발화는 코드 회귀가 아니라 재베이스 timestamp 갱신에 의한 것으로, 본 재검증이 리포트를 최신 코드보다 postdate 시켜 해소.
