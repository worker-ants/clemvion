# 신규 식별자 충돌 검토 결과 — naming_collision

## 검토 범위 확정 (중요 — 먼저 판정)

`--impl-done` payload 는 `spec/7-channel-web-chat` 전체 문서 본문(0~5번 파일)을 "target 문서"로 번들링했지만,
실제 이번 세션의 **진짜 diff**(fork-point 이후 HEAD 고유 커밋)는 아래 1건뿐이다.

```
git merge-base HEAD origin/main   = 84b1ea635 (경보 SoT)
origin/main..HEAD (이 브랜치만의 커밋) = 40a375972 fix(web-chat): 위젯 disclaimer 예시·데모 기본값 문구 해요체 통일
HEAD..origin/main (main 이 fork 이후 앞서간 커밋, 이 브랜치와 무관)
  = 7cc2f3218 refactor(hooks): embed-config 응답 DTO 파일명 §5-1 컨벤션 정렬 (#926)
  = 6e2bb0bae chore(plan): mark spec-draft-pr874-deferred-docs complete (#925)
```

즉 `git diff origin/main` 을 그대로 읽으면 `embed-config-response.dto.ts → embed-config.dto.ts`(역방향 rename처럼
보임) + `plan/complete/embed-config-dto-rename.md` 삭제가 나타나지만, 이는 **이 브랜치의 변경이 아니라 origin/main
이 fork 이후 먼저 병합한 #926/#925 의 부재로 인한 reverse-diff 오염**이다(과거 교훈: `feedback_workflow_disk_write_gap...`
계열이 아니라 fork-point 미스매치 — `project_eia_waiting_surface_command_guard.md` 에 기록된 동일 패턴). 이 파일 rename
은 신규 식별자 충돌 판단 대상에서 **제외**한다 — `EmbedConfigDto` 클래스명은 두 커밋 어디에서도 변경되지 않았고
(파일명만 왕복), 실제 HEAD 워킹트리 기준 현재 파일은 `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts`
하나뿐, 충돌 없음.

따라서 본 검토는 **실질 target = 40a375972 커밋**(disclaimer 문구 통일)을 대상으로 신규 식별자 도입 여부를 분석한다.

## 발견사항

없음(CRITICAL/WARNING/INFO 모두 해당 사항 없음) — 이 커밋은 **기존 `disclaimer` 필드의 문자열 값(한국어 안내 문구)만
교체**하며, 새 식별자(요구사항 ID·엔티티/DTO/인터페이스명·API endpoint·이벤트명·ENV/config 키·파일 경로)를 전혀
도입하지 않는다.

### 대상 diff 상세 확인
- `codebase/channel-web-chat/src/app/demo/demo-config.ts:30` — `defaultDemoForm.disclaimer` 기본값 텍스트만 변경.
- `codebase/packages/web-chat-sdk/examples/snippet.html:44` — 예제 스니펫의 `disclaimer:` 리터럴 값만 변경.
- `spec/7-channel-web-chat/2-sdk.md:46` — boot 예시 코드블록의 `disclaimer:` 리터럴 값만 변경(문서 `id: web-chat-sdk` frontmatter 등 식별자는 무변경).

세 파일 모두 필드명 `disclaimer` 자체는 새로 만든 게 아니라 기존 계약 필드([2-sdk §4 Boot config 스키마](spec/7-channel-web-chat/2-sdk.md), `BootConfig.disclaimer?: string`, `codebase/channel-web-chat/src/widget/host-bridge.ts:15`, `codebase/packages/web-chat-sdk/src/types.ts:20`, `codebase/backend/src/modules/triggers/dto/web-chat-appearance.dto.ts:70` 등)을 그대로 사용한다.

### 충돌 관점별 확인 (전부 해당 없음)
1. **요구사항 ID 충돌** — 신규 ID 부여 없음.
2. **엔티티/타입명 충돌** — 신규 타입/DTO/인터페이스 없음. `EmbedConfigDto`(위 fork-point 설명 참고)도 이 커밋과 무관.
3. **API endpoint 충돌** — 신규/변경 endpoint 없음.
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/SSE 이벤트명 없음.
5. **환경변수·설정키 충돌** — 신규 ENV var/config key 없음.
6. **파일 경로 충돌** — 신규 spec/코드 파일 없음(기존 3개 파일의 리터럴 값 1줄씩 수정).

### 참고(교차검증 — 값 자체의 정합성)
새 문구 `"AI는 한정된 데이터로 동작하며 답변이 부정확할 수 있어요."` 는 canonical 위젯 문서
`codebase/frontend/src/content/docs/06-integrations-and-config/web-chat-sdk.mdx:50` 의 기존 값과 정확히 일치 —
커밋 메시지가 주장하는 "canonical 문구로 통일" 목적과 실제 diff 가 부합함을 확인했다(이는 식별자 충돌이 아니라
값의 참(truth) 확인이며 별도 관점(rationale_continuity/cross_spec)의 영역이라 여기선 정보성으로만 부기).

## 요약
이번 세션의 실질 변경은 `spec/7-channel-web-chat` 위젯의 기존 `disclaimer` 필드 예시/기본값 **문자열 콘텐츠 1줄 교체 3건**뿐이며, 신규 식별자(요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV/설정키·파일 경로) 도입이 전혀 없어 신규 식별자 충돌 관점에서 점검할 대상 자체가 없다. `git diff origin/main` 상에 보이는 `embed-config-response.dto.ts ↔ embed-config.dto.ts` rename 및 plan 파일 삭제는 이 브랜치의 변경이 아니라 origin/main 이 fork-point 이후 별도로 병합한 #926/#925 커밋의 부재로 인한 diff 방향 오염이므로 신규 식별자 충돌 판단에서 제외했다(허위 CRITICAL 방지).

## 위험도
NONE
