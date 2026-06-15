# 문서화(Documentation) Review 결과

## 발견사항

- **[WARNING]** `spec/5-system/6-websocket-protocol.md` §4.2 `VALIDATION_ERROR` 설명에 `type:'file'` 항목 미반영 — 이번 diff 에서 EIA spec(`14-external-interaction-api.md`) 은 갱신됐으나 WS spec 은 갱신되지 않았다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/spec/5-system/6-websocket-protocol.md` §4.2 `VALIDATION_ERROR` 행
  - 상세: 구현 완료 후 consistency check(cross_spec.md WARNING #2)가 이미 이 누락을 지적했다. EIA spec §5.1 은 이번 diff 에서 `·type:'file' MIME/크기/개수` 항목을 포함하도록 갱신됐으나, WS spec §4.2 의 동일 에러 코드 설명은 여전히 scalar 목록만 열거하고 있다. 외부 WS 클라이언트 구현자는 spec 에서 file 검증 실패가 `VALIDATION_ERROR` ack 로 표면된다는 사실을 알 수 없다.
  - 제안: `spec/5-system/6-websocket-protocol.md` §4.2 `VALIDATION_ERROR` 행 끝에 `·type:'file' MIME/크기/개수` 항목 추가.

- **[INFO]** `spec/4-nodes/6-presentation/4-form.md` frontmatter `code:` 에 `form-mode.ts` 와 `types.ts` 미등재 — 단, 이번 diff 가 이를 수정하고 있다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/spec/4-nodes/6-presentation/4-form.md` 라인 1-11 frontmatter
  - 상세: 이번 diff 는 `form-mode.ts` 와 `types.ts` 를 `code:` 에 추가한다. convention compliance 검토에서도 INFO-1 로 지적됐으나 이번 변경에서 해소된다. 문서화 관점에서 문제없음 — 확인 용도로 기재.
  - 제안: 없음. 이미 반영됨.

- **[INFO]** `spec/4-nodes/6-presentation/4-form.md` §1.5 에 i18n 키 경로(`editor.runResults.formFile*`) 미명시
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/spec/4-nodes/6-presentation/4-form.md` §1.5 "실시간 검증" 하위
  - 상세: `dynamic-form-ui.tsx` JSDoc 과 `dict/ko|en/editor.ts` 에는 `editor.runResults.formFileMimeRejected` 등 4개 키가 존재하나, spec §1.5 본문에는 키 경로가 명시되지 않아 독자가 코드를 탐색해야만 실제 메시지 키를 알 수 있다. 규약 위반은 아니며 가독성 향상 제안이다.
  - 제안: spec §1.5 "실시간 검증" 절 끝에 `(i18n 키: \`editor.runResults.formFile*\`)` 한 줄 추가 — 선택 사항.

- **[INFO]** `spec/4-nodes/6-presentation/4-form.md` §1 "기본값 상수 SoT" 문구에 아키텍처 백로그 B-1 참조 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/spec/4-nodes/6-presentation/4-form.md` §1 callout "기본값 상수 SoT: backend `form-mode.ts` `DEFAULT_FILE_*`…"
  - 상세: frontend 코드 내 주석에는 "런타임 중립 공유 패키지로의 추출은 아키텍처 백로그 B-1 추적" 이 명기돼 있지만, spec 본문에는 이 백로그 참조가 없다. frontend 와 backend 의 상수 미러 구조가 향후 drift 위험이 있는 임시 상태임을 spec 독자가 파악하기 어렵다.
  - 제안: §1 callout 마지막에 `(런타임 공유 패키지 추출은 아키텍처 백로그 B-1)` 추가 — 선택 사항.

- **[INFO]** `validateFilesClient` 함수 JSDoc 존재 여부 확인 권장
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `validateFilesClient` 함수 정의부
  - 상세: convention compliance 검토(INFO-2)에서 `dynamic-form-ui.tsx` JSDoc 이 언급됐고 이번 diff 에 `validateFilesClient` 신규 공개 헬퍼가 포함된다. 본 리뷰는 실제 파일을 직접 읽지 못했으나, 신규 public-facing 검증 함수에 파라미터·반환·부작용 설명 JSDoc 이 있는지 확인이 필요하다. prompt 내 컨텍스트에서는 JSDoc 존재가 언급되지 않았다.
  - 제안: `validateFilesClient` 에 `@param`, `@returns`, 에러 반환 조건을 포함하는 JSDoc 추가 확인.

- **[INFO]** `validateFileField` 함수 JSDoc 존재 여부 확인 권장
  - 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateFileField` 함수 정의부
  - 상세: 신규 공개 검증 함수 `validateFileField` 가 `assertFormSubmissionValid` chokepoint 에서 호출되며 spec §6.2 의 핵심 계약을 구현한다. 검증 순서(MIME → per-file size → total size → count)·반환 타입·예외 조건이 주석으로 기록돼 있는지 검토가 필요하다.
  - 제안: spec §6.2 검증 순서와 `DEFAULT_FILE_*` 상수 의존 관계를 JSDoc 에 명시 권장.

---

## 요약

이번 변경(form file 검증 cluster)은 spec 문서화 품질이 전반적으로 양호하다. `spec/4-nodes/6-presentation/4-form.md` 가 Planned 표기를 제거하고 구현 완료 상태를 정확히 반영하며, `spec/5-system/14-external-interaction-api.md` §5.1 도 `type:'file'` 항목을 포함하도록 갱신됐다. spec §1.5 의 실시간 검증 동작, §6.2 의 에러 테이블, Rationale 의 cluster 분리 근거가 모두 이번 구현과 일치하도록 업데이트됐다. 단 `spec/5-system/6-websocket-protocol.md` §4.2 의 `VALIDATION_ERROR` 설명이 여전히 scalar 목록만 열거하고 `type:'file'` 항목이 빠진 점이 WARNING 수준의 문서 불완전성이며, WS 클라이언트 구현자에게 file 검증 에러 처리 계약이 전달되지 않는다. 나머지(i18n 키 경로, B-1 백로그 참조, 신규 함수 JSDoc) 는 INFO 수준의 보완 권장 사항이다.

---

## 위험도

LOW
