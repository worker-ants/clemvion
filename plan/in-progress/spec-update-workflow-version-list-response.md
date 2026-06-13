---
worktree: refactor-05-database-721c98
started: 2026-06-13
owner: resolution-applier
---
# Spec Update Draft — workflow-version-list-response

## 분류
SPEC-DRIFT (코드 개선을 spec 에 반영)

## 원본 발견사항
SUMMARY#10: [SPEC-DRIFT] `findByWorkflow` 목록에서 snapshot 제외(m-3)가 spec/3-workflow-editor/5-version-history.md §7.1에 반영되어 있지 않음. 코드가 맞고 spec이 낡은 상태. 코드 revert가 아닌 spec 갱신 필요.

## 제안 변경

### 파일
`spec/3-workflow-editor/5-version-history.md`

### 변경 위치
§7.1 버전 목록

### Before
```
### 7.1 버전 목록

`GET /workflows/:wfId/versions`

응답: `WorkflowVersion[]` (version DESC). `creator` relation 포함.
```

### After
```
### 7.1 버전 목록

`GET /workflows/:wfId/versions`

응답: `WorkflowVersionListItemDto[]` (version DESC). 메타데이터 + 작성자만 포함.
`snapshot` 필드는 응답에서 의도적으로 제외된다(목록 over-fetch 방지, m-3).
`creator` relation 포함. 상세 조회(§7.2)와의 대비:

| 필드 | 목록(§7.1) | 상세(§7.2) |
|------|-----------|-----------|
| id, workflowId, version, changeSummary, createdBy, createdAt, creator | 포함 | 포함 |
| snapshot | **제외** | 포함 |
```

## 근거
- m-3 구현: `WorkflowVersionsService.findByWorkflow()` 가 `select` 절에서 `snapshot` 을 명시 제외하며, 반환 타입도 `WorkflowVersionListItemDto[]` 로 좁혀져 있음.
- 프론트엔드: `version-history-panel.tsx` 가 `WorkflowVersionSummary` (snapshot 없음) 타입으로 목록 응답을 소비 — 실제 동작과 일치.
- spec §7.1 은 여전히 `WorkflowVersion[]` 로 표기 (snapshot 포함처럼 보임) → 독자 혼동 가능.
- 코드는 올바름; spec 이 현실을 따라와야 한다.
