---
worktree: system-status-recent-failed-86831b
started: 2026-06-03
owner: planner
---

# Spec Draft — system-status failed 지표 "최근 윈도우 + 누적(보관 중)" 병기

대상: `spec/5-system/16-system-status-api.md`, `spec/2-navigation/15-system-status.md`, `spec/2-navigation/_product-overview.md §3.9`

## 0. spec frontmatter status 전이 체크리스트 (적용 시 의무)

`spec-impl-evidence.md §3` 라이프사이클 준수:

- [ ] `spec/5-system/16-system-status-api.md`: `status: implemented` → **`partial`** 로 전환, `pending_plans: [plan/in-progress/system-status-recent-failed.md]` 추가. (recentFailed/windowed surface 가 아직 미구현이므로. `code:` glob 은 기존 매치 유지 → 가드 통과.) developer 가 구현 완료 + 본 plan 을 `complete/` 로 이동하는 commit 에서 `implemented` 로 승격.
- [ ] `spec/2-navigation/15-system-status.md`: 동일하게 `partial` + `pending_plans` 추가, 구현 완료 시 `implemented` 승격.
- [ ] `spec/2-navigation/_product-overview.md`: `_` prefix 라 frontmatter 가드 제외 대상 — status 변경 불필요. NAV-SS 표만 갱신.

## A. 16-system-status-api.md 변경안

### §2 API — DTO 변경 (additive, 하위호환)

```
SystemStatusOverviewDto {
  generatedAt: string;
  overall: "healthy" | "degraded" | "down";
  totalFailed: number;             // 전 큐 failed(보관 중 누적) 합산 — 기존 유지
  totalRecentFailed: number;       // 신규: 전 큐 recentFailed 합산
  failedWindowMinutes: number;     // 신규: recentFailed 산정 윈도우(분). env SYSTEM_STATUS_FAILED_WINDOW_MINUTES, 기본 60
  queues: QueueStatusDto[];
}

QueueStatusDto {
  name: string;
  group: ...;
  counts: { waiting; active; delayed; failed; paused; };  // failed = 보관 중 누적 (기존 의미 유지)
  recentFailed: number;            // 신규: 최근 윈도우 내 finishedOn 기준 실패 수 (스캔 캡 도달 시 하한값)
  concurrency: number;
  utilization: number;
  isPaused: boolean;
  health: ...;
}
```

- `failed`(및 `totalFailed`) 의 의미를 본문에 명확화: "큐의 `removeOnFail` 보관기간 내에 **현재 보관 중인** 실패 잡 수" — lifetime 누적이 아님. (큐별 보관정책: `execution-continuation` 무한(`removeOnFail: false`), 그 외 100건/5분/7일/30일 등 상이.)
- `recentFailed`: `queue.getFailed()` 로 가져온 실패 잡 중 `finishedOn >= now - failedWindowMinutes*60_000` 인 수.
- **구현 노트(DTO 파일명)**: 구현 시 DTO 파일명은 swagger 규약 §5-1 에 따라 `*-response.dto.ts` 패턴 유지(`system-status-response.dto.ts`). 신규 필드는 기존 클래스에 `@ApiProperty` 로 추가.

### §2 구현/비용 노트 변경 (현행 "상수 비용" 문장을 아래로 **교체**)

- 현행 문장: "추가 Redis 비용은 **큐 수에 비례하는 상수** (job 처리량과 무관 — getJobCounts 는 카운터 조회)." → 이 문장은 더 이상 정확하지 않으므로 **삭제하고** 아래로 대체한다.
- 대체: `waiting/active/delayed/failed/paused` 집계는 종전대로 `getJobCounts`(큐당 상수). 단 `recentFailed` 산정을 위해 큐마다 `queue.getFailed()` 를 **newest→역순으로 스캔**해 `finishedOn` 이 윈도우를 벗어나면 중단한다. 따라서 추가 비용은 **윈도우 내 실패 수 + 스캔 캡에 비례**(더 이상 상수 아님).
- 큐당 스캔 상한(캡) env `SYSTEM_STATUS_FAILED_SCAN_CAP`(기본 1000). 캡 도달 시 스캔을 멈추고 `recentFailed` 는 **하한값**으로 간주(UI 는 "N+" 표기 가능).
- 윈도우는 보관기간보다 짧게 운영하는 것을 전제(기본 60분 ≪ 대부분 큐 보관기간). 보관기간이 윈도우보다 짧은 큐(`cafe24-token-refresh` 5분)는 `recentFailed` 가 보관분으로 제한될 수 있음을 명시.

### §3 health 파생 규칙 변경

규칙 3만 교체(규칙 1·2 불변):

3. `recentFailed >= 코드상수 FAILED_DEGRADED_THRESHOLD` 또는 `delayed >= DELAYED_DEGRADED_THRESHOLD` → **degraded**

- 코드상수 `FAILED_DEGRADED_THRESHOLD` ← env `SYSTEM_STATUS_FAILED_THRESHOLD`(기본 1), `DELAYED_DEGRADED_THRESHOLD` ← env `SYSTEM_STATUS_DELAYED_THRESHOLD`(기본 50). (env↔상수 매핑을 §3 에 명시해 혼용 해소.)
- **의미 변경 주의 노트**(§3 env 설명에 추가): `SYSTEM_STATUS_FAILED_THRESHOLD` 의 비교 대상이 기존 "보관 중 누적 failed" 에서 **"최근 윈도우 recentFailed"** 로 바뀐다. 기존 설정값을 유지해 배포하면 degraded 판정 동작이 달라지므로 운영자는 설정값을 재검토한다.
- 규칙 1(paused→down)·규칙 2(`waiting>0 && active==0`→down, R-3 워커 미가동 추정)은 **변경 없음**. 규칙 2 는 `recentFailed` 와 **독립 동작**한다.

### Rationale R-5 (신규)

- **왜 윈도우 실패를 도입했는가**: 스냅샷 지표(waiting/active/delayed/paused/utilization)는 이미 "현재 상태"지만 `failed` 만 누적성이라 "전 기간 누적"처럼 읽혔다. 최근 윈도우 수치를 주 지표로 두고 누적은 참고치로 병기해 "지금 정상인가" 목적에 맞춘다.
- **누적이 진짜 lifetime 이 아닌 이유**: `getJobCounts('failed')` 는 BullMQ `removeOnFail` 보관 집합의 크기이고, 큐마다 보관정책이 달라(무한~5분) lifetime 합계가 아니다. 그래서 라벨을 "누적(보관 중)" 으로 명확화했다.
- **상수 비용 전제 포기 근거(연속성)**: 기존 구현 노트(§2)는 "getJobCounts Redis 카운터 조회 → 큐 수 비례 상수" 를 비용 이점으로 들었다. `recentFailed` 는 `getFailed()` 스캔이 필요해 이 상수성을 포기한다. 트레이드오프로 "현재 상태 반영" 을 우선하되, 스캔 캡(`SYSTEM_STATUS_FAILED_SCAN_CAP`)으로 비용 상한을 보장한다.
- **R-2(throughput 시계열 v1 제외)와의 대조**: R-2 의 throughput 추이는 별도 샘플링 cron·저장소가 필요하지만, `recentFailed` 는 BullMQ 가 이미 보관 중인 failed 집합을 윈도우 필터링할 뿐이라 **별도 저장소가 불필요**하다. 시계열(추이)이 아닌 단일 윈도우 스냅샷이라는 점에서 R-2 의 결정과 모순되지 않는다.
- **health 를 윈도우로 옮긴 이유**: degraded 가 "지금" 문제인지를 반영하도록. 기존엔 보관 실패 1건만 있어도 영구 degraded → 오탐. 윈도우 기준이면 최근 실패가 사라지면 자동 healthy 복귀.

## B. 15-system-status.md (UI) 변경안

### §1 화면 구조 ASCII — 교체안

종합 헤더와 카드의 실패 표기를 병기로 교체:

```
│  ┌──────────────────────────────────────────────────────────┐│
│  │  🟢 시스템 정상   실패(최근 60분): 0 · 누적 보관: 0        ││
│  └──────────────────────────────────────────────────────────┘│
...
│  │ background-execution 🟢│ │ execution-continuation 🟢│     │
│  │ 대기 0 · 처리중 1       │ │ 대기 0 · 처리중 0        │     │
│  │ 지연 0 · 실패(최근) 0   │ │ 지연 0 · 실패(최근) 0    │     │
│  │   └ 누적 보관 0         │ │   └ 누적 보관 0          │     │
│  │ 포화도 ▓░░░ 33%         │ │ 포화도 ░░░░ 0%           │     │
```

### §2.2 종합 상태 헤더 (현행 totalFailed 단독 배지 문장을 **교체**)

- `totalRecentFailed`(최근 윈도우 실패 합계)를 **주 배지**로, `totalFailed`(누적 보관)를 **부 배지**로 병기한다. 주 배지는 0 초과 시 강조.
- 윈도우 길이는 `failedWindowMinutes` 응답값을 라벨에 반영("최근 N분 실패").

### §2.3 큐 그룹 카드

- 실패 카운트를 "실패(최근 윈도우)"(주) + "누적 보관"(부)로 병기한다. 주 수치 0 초과 시 강조.
- 캡 초과 시 "N+" 표기 허용.

### §3 i18n

- KO/EN dict 에 최근/누적 라벨 키 추가(`systemStatus.counts.recentFailed`, `systemStatus.counts.retainedFailed`, `systemStatus.totalRecentFailed`, `systemStatus.failedWindow` 등).

### Rationale R-3 (UI spec, 신규 정식 항목)

**R-3. 최근 실패를 주 지표, 누적을 부 지표로 둔 이유**
스냅샷 지표는 이미 현재 상태를 반영하지만 실패 수만 보관 정책에 따라 누적되어 "전 기간 누적" 으로 오인됐다. "지금 정상인가" 가 본 화면의 목적이므로 최근 윈도우 실패를 주 지표로 전면화하고, 디버깅 참고용 누적(보관 중)은 부 지표로 병기한다. 산정 방식·비용·health 연동 근거는 [API spec R-5](../5-system/16-system-status-api.md#rationale) 참조.

## C. _product-overview.md §3.9 변경안 (NAV-SS 표에 행 추가)

| NAV-SS-07 | 실패 지표를 "최근 윈도우(기본 60분) 주 지표 + 누적 보관 부 지표" 로 병기 | 필수 | 🚧 |
| NAV-SS-08 | 윈도우 길이를 라벨에 반영("최근 N분 실패"), health(degraded) 판정도 최근 윈도우 실패 기준 | 권장 | 🚧 |

## D. INFO 동기화 (적용 시 함께)

- `spec/5-system/_product-overview.md §5 NF-OB-06`: 설명을 "실패 지표는 최근 윈도우 기준 주 지표 + 누적 보관 부 지표" 로 동기화(직접 충돌은 아니나 일관성). `_` prefix 파일이라 frontmatter status 무관.

## 진행 체크리스트 (적용 단계)

- [ ] §0 frontmatter status 전이 (16-, 15- 두 파일 `partial` + pending_plans)
- [ ] §A 16-system-status-api.md 본문(§2 DTO·비용노트, §3 health, R-5)
- [ ] §B 15-system-status.md 본문(§1 ASCII, §2.2/§2.3, R-3)
- [ ] §C _product-overview.md NAV-SS-07/08
- [ ] §D NF-OB-06 동기화
- [ ] 재-consistency-check BLOCK: NO 확인
