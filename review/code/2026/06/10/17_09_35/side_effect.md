# 부작용(Side Effect) Review

## 리뷰 대상

`spec/data-flow/` 하위 14개 Markdown 문서의 수정·신규 추가 변경.

---

## 발견사항

### 발견사항 1
- **[INFO]** 리뷰 대상 파일 전체가 `spec/` 하위 Markdown 문서 전용 변경
  - 위치: 파일 1~14 전체
  - 상세: 모든 변경이 `.md` 스펙 문서 내 텍스트·다이어그램·표 서술 갱신이다. 실행 가능한 코드(TypeScript, Python, SQL 등)는 한 줄도 포함되지 않는다. 런타임 상태, 전역 변수, 파일시스템 I/O, 네트워크 호출, 이벤트 발생 등 부작용의 실제 발생 경로가 없다.
  - 제안: 해당 없음.

### 발견사항 2
- **[INFO]** 신규 파일 추가 (`13-agent-memory.md`, `14-chat-channel.md`, `15-external-interaction.md`)
  - 위치: `spec/data-flow/13-agent-memory.md`, `spec/data-flow/14-chat-channel.md`, `spec/data-flow/15-external-interaction.md`
  - 상세: 기존에 없던 파일이 생성된다. 파일시스템에 새 파일이 추가되는 것은 의도된 동작이며, 기존 파일을 덮어쓰거나 삭제하지 않는다. `spec/data-flow/0-overview.md` 또는 상위 색인이 새 파일을 참조하도록 갱신되지 않았을 가능성이 있으나, 이는 링크 누락 이슈이며 부작용(기존 동작의 의도치 않은 변경)은 아니다.
  - 제안: 색인 문서(`spec/data-flow/0-overview.md`)에 신규 파일 링크 추가 여부를 별도 확인.

### 발견사항 3
- **[INFO]** 기존 spec 서술 교정 — 구현 갭 명시 (`10-triggers.md`, `11-workflow.md`, `7-llm-usage.md`)
  - 위치: 파일 1(`10-triggers.md`) §1.4, 파일 2(`11-workflow.md`) §1.4, 파일 12(`7-llm-usage.md`) §1.3 Rationale
  - 상세: 이전 spec이 "양방향 동기화", "AI 노드가 세 ID를 채운다" 등의 부정확한 서술을 담고 있었으며, 이번 변경이 실제 코드 동작과 맞게 교정한다. 이는 코드 변경이 아니라 문서가 현실을 따라잡는 수정이므로 의도치 않은 부작용이 없다. 단, 이 교정으로 인해 spec을 인용하는 다른 문서(예: `spec/1-data-model.md` §2.9.1)가 여전히 "양방향 동기화" 계약을 기술하고 있다면 일관성 갭이 잔존할 수 있으나, 이는 side-effect 범주가 아닌 consistency 이슈다.
  - 제안: `spec/1-data-model.md §2.9.1`의 "역방향도 동일" 계약 서술이 이번 갱신과 정합하는지 consistency-checker를 통해 별도 확인 권장.

### 발견사항 4
- **[INFO]** 함수명 참조 교정 (`12-workspace.md`, `2-auth.md`)
  - 위치: 파일 3(`12-workspace.md`) §1.4, 파일 7(`2-auth.md`) §1.2
  - 상세: `resolveWorkspaceForToken` → `resolveTokenWorkspaceContext`, `sendInvitationEmail` → `sendWorkspaceInvitationEmail` 등 실제 코드 함수명으로 교정. 이 변경 자체는 문서 수준이며, 만약 다른 spec 문서가 구 함수명을 직접 인용하고 있다면 dead reference가 될 수 있으나, 구 spec 문서가 잘못 기술하고 있던 것의 수정이라 부작용이 아니다.
  - 제안: 해당 없음.

---

## 요약

이번 변경의 전체 14개 파일은 `spec/data-flow/` 디렉터리 내 Markdown 스펙 문서만을 대상으로 한다. 실행 가능한 코드·마이그레이션·설정 파일은 포함되지 않으며, 런타임 상태 변경·전역 변수 조작·파일시스템 파괴·네트워크 호출·이벤트 발생 등 의도치 않은 부작용을 일으킬 수 있는 경로가 구조적으로 존재하지 않는다. 신규 `.md` 파일 3개 추가와 기존 파일 교정이 전부이며, 변경의 의도(구현 사실과 spec 불일치 해소, 구현 갭 명시)와 실제 변경 내용이 일치한다.

---

## 위험도

NONE
