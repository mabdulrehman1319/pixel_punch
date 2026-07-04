create database PixelPunchDB;
use PixelPunchDB;

--Table 1
create table Users(
 UserID int identity(1,1) primary key,
 Username varchar(50) not null unique,
 Email varchar(90) not null unique,
 PasswordHash varchar(64) not null,
 CreatedAt Datetime not null default getdate()
);


create table CPUs(
CPUID int identity(1,1) primary key,
CPU_Name varchar(100) not null,
CPU_Brand varchar (50) not null,
Cores int not null check (Cores>0),
BaseClock decimal(4,2) not null check (BaseClock > 0),
PerformanceTier int not null check (PerformanceTier between 1 and 10)
);


create table GPUs(
GPUID int identity(1,1) primary key,
GPU_Name varchar(100) not null,
GPU_Brand varchar(50) not null,
VRAM int not null check (VRAM > 0), ---in GBs
ScoreMultiplier decimal(4,2) not null check (ScoreMultiplier > 0),
Tier int not null check (Tier between 1 and 10)
);


create table Games(
GameID int identity(1,1) primary key,
Title varchar(100) not null,
Genre varchar(100) not null,
DifficultyMultiplier decimal(4,2) not null check (DifficultyMultiplier > 0),
MinVRAM int not null check (MinVRAM > 0), ---in GBs
MinRAM int not null check (MinRAM > 0)
);


create table HardwareProfiles(
ProfileID int identity(1,1) primary key,
UserID int not null foreign key references Users(UserID),
CPUID int not null foreign key references CPUs(CPUID),
GPUID int not null foreign key references GPUs(GPUID),
RAM int not null check (RAM > 0), ---in GBs
ProfileName varchar(100) not null
);


create table BenchmarkResults(
ResultID int identity(1,1) primary key,
UserID int not null foreign key references Users(UserID),
GameID int not null foreign key references Games(GameID),
CPUID int not null foreign key references CPUs(CPUID),
GPUID int not null foreign key references GPUs(GPUID),
RAM int not null check (RAM >0),
MinFPS decimal(6,2) not null check (MinFPS >= 0),
AvgFPS decimal(6,2) not null check (AvgFPS >= 0),
MaxFPS decimal(6,2) not null check (MaxFPS >= 0),
CPU_Usage decimal(5,2) not null check (CPU_Usage between 0 and 100),
GPU_Usage decimal(5,2) not null check (GPU_Usage between 0 and 100),
RAM_Usage decimal(5,2) not null check (RAM_Usage between 0 and 100),
Avg_Temp decimal(5,2) not null check (Avg_Temp > 0),
Peak_Temp decimal(5,2) not null check (Peak_Temp > 0),
Time_Stamp datetime not null default getdate()
);


create table BenchmarkComparisons(
ComparisonID int identity(1,1) primary key,
ResultID_A int not null foreign key references BenchmarkResults(ResultID),
ResultID_B int not null foreign key references BenchmarkResults(ResultID),
UserID int not null foreign key references Users(UserID),
CreatedAt datetime not null default getdate()
);


create table GameRequirements(
ReqID int identity(1,1) primary key,
GameID int not null foreign key references Games(GameID),
MinRAM int not null check (MinRAM > 0),
Recommended_RAM int not null check (Recommended_RAM > 0),
Recommended_VRAM int not null check (Recommended_VRAM > 0)
);

create table Reviews(
ReviewID int identity(1,1) primary key,
UserID int not null foreign key references Users(UserID),
GameID int not null foreign key references Games(GameID),
StarRating int not null check (StarRating between 1 and 5),
ReviewText varchar(max) not null,
CreatedAt datetime not null default getdate()
);


create table Comments(
CommentID int identity(1,1) primary key,
UserID int not null foreign key references Users(UserID),
ResultID int not null foreign key references BenchmarkResults(ResultID),
CommentText varchar(max) not null,
CreatedAt datetime not null default getdate()
);


create table Notifications(
NotifID int identity(1,1) primary key,
UserID int not null foreign key references Users(UserID),
Message varchar(255) not null,
IsRead bit not null default 0,
CreatedAt datetime not null default getdate()
);


create table Settings(
SettingID int identity(1,1) primary key,
UserID int not null unique foreign key references Users(UserID),
Default_Game int null foreign key references Games(GameID),
Theme varchar(20) not null default 'Light' check (Theme in ('Light' , 'Dark')),
Resolution varchar(20) not null default '1920x1080'
);


use PixelPunchDB;
select * from Users;
select * from BenchmarkResults;
select * from BenchmarkComparisons;
select * from CPUs;
select * from GPUs;
select * from Games;
select * from GameRequirements;
select * from Reviews;
select * from Notifications;
select * from Settings;
select * from Comments;
select * from HardwareProfiles;


create function dbo.GetBottleneckScore (
    @CpuID int,
    @GpuID int
)
returns varchar(50)
as
begin
    declare @CpuTier int;
    declare @GpuTier int;
    declare @TierDifference int;
    declare @Result varchar(50);
    -- Fetch tiers from respective tables
    select @CpuTier = PerformanceTier from CPUs where CPUID = @CpuID;
    select @GpuTier = Tier from GPUs where GPUID = @GpuID;
    set @TierDifference = abs(@CpuTier - @GpuTier);
    if @TierDifference <= 2
        set @Result = 'Low (Balanced System)';
    else if @TierDifference <= 5
        set @Result = 'Moderate Bottleneck';
    else
        set @Result = 'High Bottleneck';
    return @Result;
end;

--Check Game Hardware Compatibility
--This function checks if a specific hardware profile (RAM and VRAM)
--meets the minimum requirements for a specific game. It returns a quick
--'Pass' or 'Fail' insight.
create function dbo.CheckGameCompatibility (
    @GameID int,
    @UserRAM int,
    @GpuID int
)
returns varchar(20)
as
begin
    declare @MinRAM int;
    declare @MinVRAM int;
    declare @UserVRAM int;
    declare @Status varchar(20);
    -- Get game's minimum requirements
    select @MinRAM = MinRAM, @MinVRAM = MinVRAM 
    from Games 
    where GameID = @GameID;
    -- Get user's GPU VRAM
    select @UserVRAM = VRAM 
    from GPUs 
    where GPUID = @GpuID;
    -- Check if user hardware meets or exceeds the requirements
    if @UserRAM >= @MinRAM and @UserVRAM >= @MinVRAM
        set @Status = 'Pass';
    else
        set @Status = 'Fail';

    return @Status;
end;


--triggers
--Auto-Create User Settings on Sign-Up
create trigger trg_AfterUserInsert
on Users
after insert
as
begin
    -- Turn off the row-count message for performance
    set nocount on;
    -- Insert default settings for the newly created UserID
    insert into Settings (UserID, Default_Game, Theme, Resolution)
    select UserID, null, 'Light', '1920x1080'
    from inserted;
end;

--Prevent Duplicate Benchmark Comparisons
create trigger trg_PreventSelfComparison
on BenchmarkComparisons
instead of insert
as
begin
    set nocount on;

    -- Check if any row being inserted tries to compare a result with itself
    if exists (select 1 from inserted where ResultID_A = ResultID_B)
    begin
        -- Roll back the transaction and throw a basic error
        raiserror('Error: You cannot compare a benchmark result with itself.', 16, 1);
    end
    else
    begin
        -- If it passes the check, proceed with the actual insert
        insert into BenchmarkComparisons (ResultID_A, ResultID_B, UserID, CreatedAt)
        select ResultID_A, ResultID_B, UserID, isnull(CreatedAt, getdate())
        from inserted;
    end
end;

--Procedures

--Register a New Benchmarking Result
create procedure dbo.AddBenchmarkResult
    @UserID int,
    @GameID int,
    @CpuID int,
    @GpuID int,
    @RAM int,
    @MinFPS decimal(6,2),
    @AvgFPS decimal(6,2),
    @MaxFPS decimal(6,2),
    @CpuUsage decimal(5,2),
    @GpuUsage decimal(5,2),
    @RamUsage decimal(5,2),
    @AvgTemp decimal(5,2),
    @PeakTemp decimal(5,2)
as
begin
    set nocount on;
    if @AvgFPS < @MinFPS
    begin
        print 'Error: Average FPS cannot be less than Minimum FPS.';
        return;
    end
    insert into BenchmarkResults (
        UserID, GameID, CPUID, GPUID, RAM, 
        MinFPS, AvgFPS, MaxFPS, 
        CPU_Usage, GPU_Usage, RAM_Usage, 
        Avg_Temp, Peak_Temp, Time_Stamp
    )
    values (
        @UserID, @GameID, @CpuID, @GpuID, @RAM, 
        @MinFPS, @AvgFPS, @MaxFPS, 
        @CpuUsage, @GpuUsage, @RamUsage, 
        @AvgTemp, @PeakTemp, getdate()
    );
    print 'Benchmark result added successfully!';
end;

--Get a Game Performance Report
create procedure dbo.GetGamePerformanceReport
    @GameID int
as
begin
    set nocount on;
    if not exists (select 1 from BenchmarkResults where GameID = @GameID)
    begin
        print 'No benchmark data found for this game yet.';
        return;
    end
    select 
        g.Title as GameTitle,
        count(b.ResultID) as TotalTestsRun,
        avg(b.AvgFPS) as OverallAvgFPS,
        max(b.MaxFPS) as HighestRecordedFPS,
        avg(b.CPU_Usage) as AvgCpuUsage,
        avg(b.GPU_Usage) as AvgGpuUsage
    from Games g
    join BenchmarkResults b on g.GameID = b.GameID
    where g.GameID = @GameID
    group by g.Title;
end;



--sql queries

--user details
select Username, Email, CreatedAt 
from Users;

--all benchmarks for specific user
select ResultID, GameID, AvgFPS, CPU_Usage, GPU_Usage 
from BenchmarkResults 
where UserID = 1;


--List All Games That Require More Than 8GB of RAM
select Title, Genre, MinRAM 
from Games 
where MinRAM > 8;

--Get the Highest Average FPS Recorded for Each Game
select GameID, max(AvgFPS) as HighestAvgFPS 
from BenchmarkResults 
group by GameID;

--Combine User Names with Their Benchmark Results (INNER JOIN)
select u.Username, b.ResultID, b.AvgFPS, b.Time_Stamp 
from Users u
join BenchmarkResults b on u.UserID = b.UserID;

--Show Full Benchmark Details (User Name, Game Title, and FPS)
select u.Username, g.Title as GameTitle, b.AvgFPS, b.MinFPS, b.MaxFPS
from BenchmarkResults b
join Users u on b.UserID = u.UserID
join Games g on b.GameID = g.GameID;

--Find CPUs Belonging to a Specific Brand (e.g., AMD or Intel)
select CPU_Name, Cores, BaseClock 
from CPUs 
where CPU_Brand = 'AMD';

--Count the Total Number of Reviews Written for Each Game
select g.Title, count(r.ReviewID) as TotalReviews
from Games g
left join Reviews r on g.GameID = r.GameID
group by g.Title;

--Find Users Who Prefer 'Dark' Mode
select UserID, Resolution 
from Settings 
where Theme = 'Dark';

--List Hardware Profiles with Their Associated CPU and GPU Names
select hp.ProfileName, c.CPU_Name, g.GPU_Name, hp.RAM
from HardwareProfiles hp
join CPUs c on hp.CPUID = c.CPUID
join GPUs g on hp.GPUID = g.GPUID;


--Run userdefined functions
select dbo.GetBottleneckScore(1, 3) as BottleneckInsight;
select Title, dbo.CheckGameCompatibility(GameID, 16, 2) as CompatibilityStatus from Games;

--Run Procedures
execute dbo.AddBenchmarkResult 1, 1, 1, 1, 16, 45.0, 60.5, 85.0, 75.0, 90.0, 65.0, 70.0, 78.5;
execute dbo.GetGamePerformanceReport @GameID = 1;