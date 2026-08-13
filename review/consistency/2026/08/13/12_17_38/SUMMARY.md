# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 성공, CRITICAL 0건)

## 전체 위험도
**LOW** — docs-only 커밋(`5d4655ceb`, Redis 키 인벤토리 포인터 정합화). 코드 변경 없음. CRITICAL 0건, WARNING 2건(모두 규약 문서 각주 보강 수준), INFO 다수.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `chat-channel:`/`chat-channel-lock:` 키가 §1 "도메인:용도:식별자" 2세그먼트-헤드 형태를 벗어나는데, 이번에 처음 인벤토리에 등재되면서도 external-interaction 사례처럼 명시적 예외 각주가 없음 | `spec/conventions/redis-keys.md` §3 인벤토리 표, `chat-channel` 신규 행 | §1 키 형태 규칙 + §3 하단 "다중 접두 모듈" 각주(현재 external-interaction 만 지목) | §3 하단 각주에 `chat-channel`(verbose/약어 병용) 한 줄 추가하거나 §1 예외로 명시 |
| 2 | convention_compliance | `redis-keys.md` §3 이 "상세 SoT" 로 새로 지정한 `4-cafe24.md §9.8` 이 CLAUDE.md 3섹션 구조상 "Rationale" 섹션 안에 위치 — 순수 기술 명세(HMAC 알고리즘·키 포맷)를 담고 있어 "Rationale=배경/근거" 관례와 불일치 | `spec/conventions/redis-keys.md` §3, cafe24 포인터 | CLAUDE.md "정보 저장 위치" 표 | (a) §9.8 의 순수 기술 명세를 본문 절로 이관하거나 (b) 문서구조 규약에 이 파일의 기존 예외 패턴을 명문화. 이번 diff 가 새로 만든 문제는 아니며 §9.1~9.9 전체의 기존 구조 — 급하지 않음 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `cc:dedup:*` TTL·fail-open 상세가 `data-flow/14 §2.2`(신규 SoT)와 `15-chat-channel.md` CCH-SE-02(기존 prose) 두 곳에 중복 서술(값은 일치) | 두 문서 | 차기 turn 에서 CCH-SE-02 를 "상세는 data-flow/14 §2.2 참조" 로 축약 |
| 2 | cross_spec | 신규 표 각주("`INCR`+첫 증가 시 `EXPIRE`" = fixed-window)가 정확한데 코드 docstring 은 "슬라이딩 윈도우" — spec-vs-code-comment 오기 | `12-webhook.md §6` ↔ `public-webhook-quota.service.ts` | 이미 plan 에 developer 후속으로 등재됨 |
| 3 | convention_compliance | 신규 blockquote 줄 `>` 뒤 공백 누락 | `spec/5-system/12-webhook.md:350` | 공백 추가 |
| 4 | convention_compliance | 신규/수정 포인터 링크 다수가 "§N" 텍스트를 적으면서 앵커를 안 달아 파일 전체로만 이동 | `12-webhook.md:342`, `redis-keys.md:59-63` | 나머지 행에도 앵커 추가(필수 아님) |
| 5 | naming_collision | §3 "다중 접두 모듈" 각주가 external-interaction 만 지목, chat-channel 미포함 | `redis-keys.md:67-69` | WARNING #1 과 동일 지점 |
| 6 | naming_collision | `chat-channel:` 계열이 §1 "용도" 세그먼트 생략(자매 lock 은 반대로 꼬리에 배치) | `redis-keys.md:61` | 문서적 각주로 "레거시 예외" 표시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | CRITICAL/WARNING 없음. INFO 2건(값-일치 중복 SoT, spec-vs-code-comment 오기 — 둘 다 추적 중) |
| rationale_continuity | NONE | 발견 없음. 포인터 이동 2건 모두 이동 대상이 이미 자신을 상세 SoT 로 선언 중이었음을 실측 확인 |
| convention_compliance | LOW | WARNING 2건, INFO 2건(형식) |
| plan_coherence | NONE | diff 가 백로그 미해결 4건을 1:1 로 해소하고 새 잔여 결함(docstring 오기)도 빠짐없이 신규 등재 |
| naming_collision | NONE | INFO 2건은 convention_compliance WARNING 과 동일 지점의 약한 버전 |

## 권장 조치사항

1. (선택) §3 각주에 `chat-channel` 추가 + `chat-channel:`/`chat-channel-lock:` 이 §1 의 의도적 예외임을 명시.
2. (선택) `4-cafe24.md §9.8` 의 기술 명세를 본문 절로 이관하거나 문서구조 예외를 명문화.
3. (선택) CCH-SE-02 의 `cc:dedup:*` 상세를 `data-flow/14 §2.2` 참조로 축약.
4. (선택) `12-webhook.md:350` blockquote 공백 보정.
5. 코드 docstring "슬라이딩 윈도우" 오기는 이미 plan 에 등재됨.

BLOCK 사유 없음 — 이번 target 커밋은 push 가능.

---

## 이 라운드 처분 (main Claude)

**WARNING 1 · INFO 3·4 반영, WARNING 2 · INFO 1 은 백로그 등재.**

**WARNING 1 — 반영.** 내가 만든 갭이다. verbose 2계열을 인벤토리에 올리면서 그 키들이 §1
형태 규칙을 벗어난다는 사실을 적지 않았다. 규약 문서가 자기 규칙의 예외를 침묵하면, 다음
사람은 그 예외를 **선례로** 읽는다. 각주 두 개를 넣었다 — 다중 접두 목록에 `chat-channel`
추가, 그리고 형태 예외를 **어디까지인지 긋는** 문단(`chat-channel:` 은 용도 생략,
자매 lock 은 용도를 꼬리에). 마지막 문장을 "신규 키는 §1 을 따른다" 로 닫았다.

**INFO 4 — 반영.** 이 PR 의 주제가 "포인터가 실제로 무언가를 가리키는가" 인데 정작 내가 단
포인터 다수가 **파일 전체로만** 이동했다. 인벤토리 표 5행에 앵커를 달았다.

> 앵커를 **또 추측해서 두 개를 틀렸다** (`#22-redis`, `#6-보안`). 실제는
> `#22-redis--bullmq`(제목이 "Redis / BullMQ")와 `#6-구현-파일-구조`다.
> `spec-link-integrity` 가 잡았고 헤딩에서 직접 뽑아 고쳤다. **이 브랜치에서 앵커를 손으로
> 지어낸 것이 세 번째다** — 규칙을 안다고 생각할 때가 가장 위험하다. 헤딩 문자열을 먼저 읽어라.

**INFO 3 — 반영** (blockquote 공백).

**WARNING 2 · INFO 1 — 백로그 등재.** 둘 다 이번 diff 가 만든 결함이 아니고 파급이 이 PR
범위를 넘는다. WARNING 2 는 `4-cafe24.md §9` **전체**의 구조 문제이고(§9.8 만 옮기면 §9 안에서
일관성이 더 깨진다), INFO 1 은 CCH-SE-02 본문 축약이라 chat-channel spec 을 다시 여는 일이다.
**다만 "나중에" 로 흘리지 않도록 plan 에 항목으로 박았다** — 이 세션에서 배운 것이다
(미룬 항목은 그 턴에 `plan/` 에 적는다).
